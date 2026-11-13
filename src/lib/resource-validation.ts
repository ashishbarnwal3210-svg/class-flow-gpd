import { z } from 'zod';

export const RESOURCE_MAX_BYTES = 50 * 1024 * 1024;
const supportedExtensions = new Set(['pdf','doc','docx','ppt','pptx','xls','xlsx','txt','png','jpg','jpeg','webp','gif','zip']);
const supportedMime = new Set(['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain','image/png','image/jpeg','image/webp','image/gif','application/zip','application/x-zip-compressed']);
const mimeByExtension: Record<string,string> = {pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',txt:'text/plain',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',zip:'application/zip'};
export function resourceMimeType(file: Pick<File,'name'|'type'>): string {
  const extension=file.name.split('.').pop()?.toLowerCase()||'';
  const browserMime=file.type.trim().toLowerCase().split(';')[0];
  return (supportedMime.has(browserMime)?browserMime:null)||mimeByExtension[extension]||'application/octet-stream';
}
export function validateResourceFile(file: Pick<File,'name'|'size'|'type'>): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const browserMime=file.type.trim().toLowerCase().split(';')[0];
  const genericMime=!browserMime||browserMime==='application/octet-stream';
  if (!supportedExtensions.has(ext) || (!genericMime && !supportedMime.has(browserMime))) return `${file.name}: this file type is not supported.`;
  if (file.size > RESOURCE_MAX_BYTES) return `${file.name}: files must be 50 MB or smaller.`;
  if (file.size === 0) return `${file.name}: empty files cannot be uploaded.`;
  return null;
}

export const resourceMetadataSchema = z.object({
  title: z.string().trim().min(1,'Add a title for this resource.').max(160,'Title must be 160 characters or fewer.'),
  category: z.enum(['Notes','Assignment','Practical','Lab Manual','PYQ','Notice','Syllabus','Question Bank','Other']),
  assignmentType: z.string().optional(),
  pageCount: z.string().optional(),
}).superRefine((value,ctx)=>{
  if(value.category==='Assignment' && !['Assignment 1','Assignment 2','Other Assignment'].includes(value.assignmentType ?? '')) ctx.addIssue({code:'custom',path:['assignmentType'],message:'Choose the assignment type.'});
  if(value.category!=='Assignment' && value.assignmentType) ctx.addIssue({code:'custom',path:['assignmentType'],message:'Assignment type is only valid for Assignment resources.'});
  if(value.pageCount && (!/^\d+$/.test(value.pageCount) || Number(value.pageCount)<1 || Number(value.pageCount)>10000)) ctx.addIssue({code:'custom',path:['pageCount'],message:'Page count must be a whole number from 1 to 10,000.'});
});
