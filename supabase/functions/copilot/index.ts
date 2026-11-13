import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const isAcademic = (q: string) => /\b(notes?|lecture|material|resource|assignment|practical|lab|manual|previous year|pyq|question bank|syllabus|course|semester|branch|module|unit|exam|class|document|pdf|find|search|look for)\b/i.test(q);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !serviceKey) return json({ error: 'Server integration is not configured.' }, 503);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Sign in is required.' }, 401);
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'Your session could not be verified.' }, 401);

  let query = '';
  try {
    const payload = await req.json();
    query = typeof payload.query === 'string' ? payload.query.trim().slice(0, 1200) : '';
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }
  if (query.length < 2) return json({ error: 'Enter a little more to search.' }, 400);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const academicQuery = isAcademic(query);
  if (!academicQuery && !Deno.env.get('AI_API_KEY')) {
    return json({ error: 'General AI is not configured for this campus yet.' }, 503);
  }
  const { data: allowed, error: limitError } = await db.rpc('consume_ai_request', {
    p_user: user.id,
    p_operation: academicQuery ? 'copilot_search' : 'general_answer',
    p_daily_limit: Number(Deno.env.get('AI_DAILY_LIMIT') || 40),
    p_units: 1,
  });
  if (limitError) {
    console.error('AI usage limit check failed', limitError.code || 'unknown');
    return json({ error: 'AI usage controls are temporarily unavailable.' }, 503);
  }
  if (!allowed) return json({ error: 'Daily Copilot limit reached. Please try again tomorrow.' }, 429);

  if (academicQuery) {
    // Embeddings are optional. Only call a separately configured embeddings provider; the Groq chat key
    // must never be sent to the default OpenAI embedding endpoint. With no embedding provider, use FTS.
    let embedding: number[] | null = null;
    const embeddingKey = Deno.env.get('AI_EMBEDDING_API_KEY');
    if (embeddingKey) {
      try {
        const response = await fetch(Deno.env.get('AI_EMBEDDING_URL') || 'https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: { Authorization: `Bearer ${embeddingKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: Deno.env.get('AI_EMBEDDING_MODEL') || 'text-embedding-3-small',
            input: query,
          }),
          signal: AbortSignal.timeout(20_000),
        });
        if (response.ok) {
          const body = await response.json();
          const candidate = body.data?.[0]?.embedding;
          // The pgvector column is vector(1536); ignore incompatible dimensions and still run FTS.
          if (Array.isArray(candidate) && candidate.length === 1536) embedding = candidate;
        }
      } catch (error) {
        console.error('Embedding request failed', error instanceof Error ? error.name : 'unknown');
      }
    }
    const { data, error } = await db.rpc('hybrid_resource_search', {
      query_embedding: embedding,
      query_text: query,
      result_limit: 12,
      branch_filter: null,
      semester_filter: null,
      subject_filter: null,
      category_filter: null,
    });
    if (error) {
      console.error('Hybrid search failed', error.code || 'unknown');
      return json({ error: 'Academic search is temporarily unavailable.' }, 502);
    }
    const matches = data ?? [];
    if (!matches.length) return json({ route: 'academic', message: 'No matching class material found.', matches: [] });
    const resourceIds = [...new Set(matches.map((m: { resource_id: string }) => m.resource_id))];
    const { data: files } = await db.from('resource_files')
      .select('id,resource_id,original_name,mime_type,size_bytes,storage_path')
      .in('resource_id', resourceIds).is('deleted_at', null);
    const enriched = await Promise.all(matches.map(async (match: Record<string, unknown>) => {
      const resourceFiles = (files ?? []).filter((f: { resource_id: string }) => f.resource_id === match.resource_id);
      const safeFiles = await Promise.all(resourceFiles.map(async (f: Record<string, unknown>) => {
        const { data: signed } = await db.storage.from('classflow-resources')
          .createSignedUrl(String(f.storage_path), 60);
        return {
          id: f.id,
          name: f.original_name,
          mime_type: f.mime_type,
          size_bytes: f.size_bytes,
          signed_url: signed?.signedUrl ?? null,
        };
      }));
      return { ...match, files: safeFiles };
    }));
    return json({ route: 'academic', matches: enriched });
  }

  const endpoint = Deno.env.get('AI_CHAT_COMPLETIONS_URL') || 'https://api.groq.com/openai/v1/chat/completions';
  const model = Deno.env.get('AI_MODEL') || 'llama-3.3-70b-versatile';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('AI_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 700,
        messages: [
          {
            role: 'system',
            content: 'You are ClassFlow Copilot, a helpful academic assistant. Answer clearly and concisely in the language the student used. Be accurate and say when uncertain. Do not claim to have searched or read campus materials. For a specific uploaded class document, suggest using the resource search. Do not present yourself as a human or as the student’s official college authority.',
          },
          { role: 'user', content: query },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      console.error('LLM provider error', response.status);
      return json({ error: 'The AI provider could not answer just now.' }, 502);
    }
    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) return json({ error: 'The AI returned an empty response. Please try again.' }, 502);
    return json({ route: 'general', answer: answer.slice(0, 12_000) });
  } catch (error) {
    console.error('LLM request failed', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'The AI service is temporarily unavailable.' }, 502);
  }
});
