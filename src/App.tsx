import { useEffect, useMemo, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, MotionConfig } from 'framer-motion';
import { z } from 'zod';
import {
  Activity, AlertCircle, ArrowDownToLine, ArrowLeft, ArrowRight, Bell, BookMarked, BookOpen, CalendarDays, Clock3,
  Check, CheckCircle2, ChevronDown, CircleHelp, CloudUpload, ExternalLink, FileArchive, FileImage, FilePlus2, FileText, Filter,
  GraduationCap, Home, Library, LockKeyhole, LogIn, LogOut, MessageCircle, MoreHorizontal,
  Plus, Search, Settings, ShieldCheck, Sparkles, Users, UserRound, X, Upload, RefreshCw,
  Eye, EyeOff, Pencil, Send, Bookmark, Megaphone, FolderOpen, Trash2, Pin, PinOff, UserPlus,
} from 'lucide-react';
import { backendConfigured, requireBackend, supabase } from './lib/supabase';
import { resourceMetadataSchema, resourceMimeType, validateResourceFile } from './lib/resource-validation';
import { useUIStore } from './lib/ui-store';
import { uploadPrivateResourceFile } from './lib/upload';
import { compressImageIfNeeded } from './lib/compress-file';
import { getAndClearSharedData } from './lib/shared-store';
import { ThemeToggle } from './components/ThemeToggle';
import { CampusUsersDonutChart } from './components/admin/CampusUsersDonutChart';

type Resource = {
  id: string; title: string; description: string | null; category: string; assignment_type: string | null;
  branch_id: string | null; semester_id: string | null; subject_id: string | null; unit_module: string | null;
  tags: string[] | null; page_count: number | null; external_url?: string | null; created_at: string;
  is_pinned?: boolean; pinned_at?: string | null;
  profiles?: { full_name: string; classflow_id: string } | null;
  resource_files?: { id: string; original_name: string; mime_type: string; size_bytes: number; storage_path: string }[];
};
type Profile = { id: string; full_name: string; username: string; classflow_id: string; role?: string; permissions?: string[]; avatar_url?: string | null; bio?: string | null };
const categories = ['Notes', 'Assignment', 'Practical', 'Lab Manual', 'PYQ', 'Notice', 'Syllabus', 'Question Bank', 'Other'];
const relativeTime = (d: string) => { const delta = Date.now() - new Date(d).getTime(); if (delta < 60_000) return 'Just now'; if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`; if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`; return new Date(d).toLocaleDateString(); };
const prettySize = (n: number) => n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
const fileKey = (f:File) => `${f.name}:${f.size}:${f.lastModified}`;

const isTestEnv = import.meta.env.MODE === 'test';

function useStitchEffect() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const selector = '.glass-panel, .resource-card, .notice-card, .dashboard-hero, .copilot-match, .general-answer, .admin-panel, .admin-overview-card, .duty-checkbox-card, .integration-card, .profile-view, .welcome-hero';

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          if (!el.classList.contains('is-stitched') && !el.classList.contains('is-stitching')) {
            el.classList.add('is-stitching');
            window.setTimeout(() => {
              el.classList.remove('is-stitching');
              el.classList.add('is-stitched');
            }, 500);
          }
          observer.unobserve(el);
        }
      });
    }, {
      rootMargin: '0px 0px -20px 0px',
      threshold: 0.05
    });

    const scanAndObserve = () => {
      const els = document.querySelectorAll(selector);
      els.forEach(el => {
        if (!el.classList.contains('is-stitched') && !el.classList.contains('is-stitching')) {
          observer.observe(el);
        }
      });
    };

    scanAndObserve();

    const mut = new MutationObserver(() => {
      scanAndObserve();
    });
    mut.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mut.disconnect();
    };
  }, [location.pathname]);
}

function App() {
  useStitchEffect();
  const [user, setUser] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(!isTestEnv && backendConfigured);

  useEffect(() => {
    if (isTestEnv || !backendConfigured) return;
    const timer = setTimeout(() => {
      setBooting(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isStandaloneMode = typeof window.matchMedia === 'function' 
      ? window.matchMedia('(display-mode: standalone)').matches 
      : Boolean((window.navigator as any)?.standalone);
    setIsStandalone(Boolean(isStandaloneMode));

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setIsStandalone(true);
        setDeferredPrompt(null);
        setShowInstallBanner(false);
      }
    } else {
      setShowInstallModal(true);
    }
  };
  const campusUpdates=useQuery({queryKey:['campus-updates',user?.id],enabled:!!supabase&&!!user,queryFn:async()=>{const {data,error}=await requireBackend().from('notices').select('id,title,body,priority,created_at').eq('is_published',true).is('deleted_at',null).order('created_at',{ascending:false}).limit(6);if(error)throw error;return data??[];}});
  useEffect(()=>{setNotificationsOpen(false);},[location.pathname]);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) await loadProfile(data.session.user.id); else setUser(null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) window.setTimeout(() => { void loadProfile(session.user.id); }, 0); else { setUser(null); queryClient.clear(); }
    });
    return () => listener.subscription.unsubscribe();
  }, [queryClient]);
  async function loadProfile(id: string) {
    if (!supabase) return;
    const { data } = await supabase.from('profiles').select('id,full_name,classflow_id,username,avatar_url,bio').eq('id', id).maybeSingle();
    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', id).maybeSingle();
    const { data: permissionRows } = await supabase.from('user_permissions').select('permission').eq('user_id',id);
    if (data) setUser({ ...data, role: roleData?.role ?? 'student', permissions:(permissionRows??[]).map((row:any)=>row.permission) });
  }
  const pageTitle = useMemo(() => ({ '/dashboard':'Dashboard','/library':'Resource library','/copilot':'ClassFlow Copilot','/upload':'Share a resource','/communities':'Campus network','/messages':'Messages','/profile':'Your profile','/admin':'Admin studio','/settings':'Settings' } as Record<string,string>)[location.pathname] ?? 'Welcome to ClassFlow', [location.pathname]);
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); setMenuOpen(false); };
  if (booting) return <div className="boot-screen"><img className="brand-mark" src="/classflow-mark.webp" alt="ClassFlow"/><span className="boot-word">ClassFlow</span><div className="loader-line" /></div>;
  return <MotionConfig reducedMotion="user"><div className="app-shell">
    <aside className="desktop-sidebar glass-panel">
<Link to="/" className="brand"><img className="brand-glyph" src="/classflow-mark.webp" alt=""/><span>ClassFlow</span></Link>
      <div className="sidebar-label">YOUR CAMPUS</div>
      <nav className="side-nav">
        <SideLink to="/dashboard" icon={<Home size={18}/>} label="Home"/>
        <SideLink to="/library" icon={<Library size={18}/>} label="Library"/>
        <SideLink to="/copilot" icon={<Sparkles size={18}/>} label="AI Copilot"/>
        <SideLink to="/communities" icon={<Users size={18}/>} label="Communities"/>
        <SideLink to="/messages" icon={<MessageCircle size={18}/>} label="Messages"/>
      </nav>
      <div className="side-divider" />
      <div className="sidebar-label">YOUR SPACE</div>
      <nav className="side-nav">
        <SideLink to="/upload" icon={<Plus size={18}/>} label="Share a resource"/>
        <SideLink to="/profile" icon={<UserRound size={18}/>} label="Profile"/>
        {user?.role === 'admin' || user?.role === 'subadmin' ? <SideLink to="/admin" icon={<ShieldCheck size={18}/>} label="Admin studio"/> : null}
        <SideLink to="/settings" icon={<Settings size={18}/>} label="Settings"/>
      </nav>
      <div className="sidebar-bottom">
        <div className="copilot-mini"><span className="mini-spark"><Sparkles size={15}/></span><strong>Study, a little smarter.</strong><p>Find useful class material with Copilot.</p><Link to="/copilot" className="mini-link inline-flex items-center">Ask Copilot <ArrowRight size={13}/></Link></div>
        <div className="profile-strip">
          <Avatar name={user?.full_name || 'Guest'} small/>
          <div className="profile-strip-copy"><b>{user?.full_name ?? 'Guest student'}</b><span>{user?.username ? `@${user.username}` : (user?.classflow_id ?? 'Your campus awaits')}</span></div>
          {user ? <button className="icon-button tiny" title="Sign out" onClick={signOut}><LogOut size={15}/></button> : <Link className="icon-button tiny" title="Sign in" to="/auth"><LogIn size={15}/></Link>}
        </div>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <div className="mobile-brand"><Link to="/" className="brand"><img className="brand-glyph" src="/classflow-mark.webp" alt=""/><span>ClassFlow</span></Link></div>
        <div className="breadcrumbs"><span>ClassFlow</span><span className="crumb-slash">/</span><b>{pageTitle}</b></div>
        <div className="top-actions">
          <ThemeToggle />
          {!isStandalone && (
            <button className="install-header-btn" onClick={handleInstallApp} title="Install ClassFlow App on your phone">
              <ArrowDownToLine size={15}/>
              <span>Install App</span>
            </button>
          )}
          <Link to="/library" className="top-search"><Search size={16}/><span>Search resources...</span><kbd>⌘ K</kbd></Link>
          <div className="notification-wrap"><button className="icon-button notification-button" title="Campus updates" aria-label="Campus updates" aria-expanded={notificationsOpen} onClick={()=>{setNotificationsOpen(v=>!v);if(user)void campusUpdates.refetch();}}><Bell size={17}/>{!!campusUpdates.data?.length&&<span className="notification-count">{campusUpdates.data.length>9?'9+':campusUpdates.data.length}</span>}</button>{notificationsOpen&&<div className="campus-updates-popover"><div className="campus-updates-heading"><div><span className="eyebrow">CAMPUS UPDATES</span><b>Latest notices</b></div><button type="button" className="icon-button tiny" onClick={()=>setNotificationsOpen(false)} aria-label="Close campus updates"><X size={14}/></button></div>{!user?<p className="campus-updates-empty">Sign in to view campus notices.</p>:campusUpdates.isLoading?<p className="campus-updates-empty">Loading campus updates…</p>:campusUpdates.isError?<button className="campus-updates-empty retry" onClick={()=>void campusUpdates.refetch()}>Couldn’t load notices. Tap to retry.</button>:campusUpdates.data?.length?campusUpdates.data.map((notice:any)=><article className="campus-update-item" key={notice.id}><span className={`notice-symbol ${notice.priority==='urgent'?'urgent':''}`}>{notice.priority==='urgent'?'!':<Megaphone size={14}/>}</span><div><b>{notice.title}</b><p>{notice.body}</p><small>{relativeTime(notice.created_at)} · {notice.priority}</small></div></article>):<p className="campus-updates-empty">You’re all caught up. New campus notices will appear here.</p>}<Link to="/dashboard" className="campus-updates-footer" onClick={()=>setNotificationsOpen(false)}>Open campus bulletin <ArrowRight size={13}/></Link></div>}</div>
          <div className="user-menu-wrap"><button className="user-menu" onClick={() => setMenuOpen(!menuOpen)}><Avatar name={user?.full_name ?? 'Guest'} small/><ChevronDown size={13}/></button>
            {menuOpen && <div className="dropdown-menu">{user ? <><Link to="/profile" onClick={() => setMenuOpen(false)}>Your profile</Link>{(user.role === 'admin' || user.role === 'subadmin') && <Link to="/admin" onClick={() => setMenuOpen(false)} style={{fontWeight:600}}>Admin studio</Link>}<Link to="/settings" onClick={() => setMenuOpen(false)}>Settings</Link><button onClick={signOut}>Sign out</button></> : <><Link to="/auth" onClick={() => setMenuOpen(false)}>Sign in</Link><Link to="/admin" onClick={() => setMenuOpen(false)}>Admin studio</Link></>}</div>}
          </div>
        </div>
      </header>
      {!isStandalone && showInstallBanner && (
        <div className="install-bar">
          <div className="install-bar-content">
            <img src="/classflow-mark.webp" alt="ClassFlow" className="install-bar-icon" />
            <div className="install-bar-text">
              <b>Install ClassFlow App</b>
              <span>Fast, full-screen campus access right from your home screen</span>
            </div>
          </div>
          <div className="install-bar-btns">
            <button className="button primary small install-bar-action" onClick={handleInstallApp}>
              <ArrowDownToLine size={13}/> Install
            </button>
            <button className="icon-button tiny install-bar-close" onClick={() => setShowInstallBanner(false)} aria-label="Dismiss banner">
              <X size={13}/>
            </button>
          </div>
        </div>
      )}
      {!backendConfigured && <div className="setup-banner"><span className="setup-icon"><AlertCircle size={16}/></span><div><b>Connect your ClassFlow backend</b><span>Add Supabase project credentials to enable accounts, campus data, uploads and live features.</span></div><Link to="/settings">Setup guide <ArrowRight size={14}/></Link></div>}
      <motion.div key={location.pathname} className="page-content" initial={{opacity:0,y:9,filter:'blur(4px)'}} animate={{opacity:1,y:0,filter:'blur(0px)'}} transition={{duration:.34,ease:[.22,1,.36,1]}}><Routes>
        <Route path="/" element={<Welcome user={user}/>}/>
        <Route path="/auth" element={<AuthPage onSuccess={async () => { const { data } = await supabase?.auth.getUser() ?? { data: { user: null } }; if (data.user) await loadProfile(data.user.id); }}/>} />
        <Route path="/dashboard" element={<Dashboard user={user}/>}/>
        <Route path="/library" element={<LibraryPage user={user}/>}/>
        <Route path="/copilot" element={<CopilotPage user={user}/>}/>
        <Route path="/upload" element={<UploadPage user={user}/>}/>
        <Route path="/communities" element={<Communities user={user}/>}/>
        <Route path="/messages" element={<Messages user={user}/>}/>
        <Route path="/profile" element={<ProfilePage user={user} onUpdate={loadProfile}/>}/>
        <Route path="/admin" element={<AdminPage user={user}/>}/>
        <Route path="/settings" element={<SettingsPage user={user}/>}/>
        <Route path="*" element={<Welcome user={user}/>}/>
      </Routes></motion.div>
      <nav className="mobile-nav glass-panel" aria-label="Main navigation">
        <MobileLink to="/dashboard" icon={<Home size={19}/>} label="Home"/>
        <MobileLink to="/library" icon={<BookOpen size={19}/>} label="Library"/>
        <NavLink to="/upload" aria-label="Upload resource" className={({isActive}) => `mobile-add ${isActive?'active':''}`}><Plus size={22}/></NavLink>
        <MobileLink to="/messages" icon={<MessageCircle size={19}/>} label="Chat"/>
        <MobileLink to="/profile" icon={<UserRound size={19}/>} label="You"/>
      </nav>
      <ToastViewport/>
      {showInstallModal && (
        <div className="profile-post-backdrop" onClick={() => setShowInstallModal(false)}>
          <div className="install-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="install-dialog-head">
              <img src="/classflow-mark.webp" alt="ClassFlow" className="install-dialog-icon"/>
              <div>
                <h3>Install ClassFlow App</h3>
                <p>Run ClassFlow directly from your phone's home screen.</p>
              </div>
              <button className="icon-button tiny" onClick={() => setShowInstallModal(false)}><X size={15}/></button>
            </div>
            <div className="install-steps">
              <div className="install-step">
                <span className="step-num">1</span>
                <div>
                  <b>Android (Chrome):</b>
                  <p>Tap the 3 dots <b>(⋮)</b> in the top right corner of Chrome, then select <b>"Install app"</b> or <b>"Add to Home screen"</b>.</p>
                </div>
              </div>
              <div className="install-step">
                <span className="step-num">2</span>
                <div>
                  <b>iPhone (Safari):</b>
                  <p>Tap the <b>Share</b> button at the bottom, then choose <b>"Add to Home Screen"</b>.</p>
                </div>
              </div>
              <div className="install-step">
                <span className="step-num">3</span>
                <div>
                  <b>Live Auto-Updates:</b>
                  <p>Any updates or new notes added to ClassFlow appear instantly — no manual APK updating needed!</p>
                </div>
              </div>
            </div>
            <div className="install-dialog-footer">
              <button className="button primary small" onClick={() => setShowInstallModal(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </main>
  </div></MotionConfig>;
}
function SideLink({to, icon, label}:{to:string;icon:React.ReactNode;label:string}) { return <NavLink to={to} className={({isActive})=>`side-link ${isActive?'selected':''}`}>{icon}<span>{label}</span></NavLink>; }
function MobileLink({to, icon, label}:{to:string;icon:React.ReactNode;label:string}) { return <NavLink to={to} className={({isActive})=>`mobile-link ${isActive?'selected':''}`}>{icon}<span>{label}</span></NavLink>; }
function Avatar({name, small=false}:{name:string;small?:boolean}) { const initials = name.split(' ').filter(Boolean).slice(0,2).map(v=>v[0]?.toUpperCase()).join('') || 'C'; return <span className={`avatar ${small?'avatar-small':''}`} aria-label={name}>{initials}</span>; }
function toast(message:string) { useUIStore.getState().pushToast(message); }
function ToastViewport(){const items=useUIStore(state=>state.toasts);const dismiss=useUIStore(state=>state.dismissToast);return <div className="toast-region" aria-live="polite" aria-atomic="false">{items.map(item=><button className="toast" key={item.id} onClick={()=>dismiss(item.id)} title="Dismiss notification">{item.message}</button>)}</div>;}
function PageHeading({eyebrow,title,description,action}:{eyebrow?:string;title:string;description?:string;action?:React.ReactNode}) { return <div className="page-heading"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</div>; }
function DataState({title='Nothing here yet',text='Once your campus is connected, information will appear here.',icon=<FolderOpen size={22}/>,action}:{title?:string;text?:string;icon?:React.ReactNode;action?:React.ReactNode}) { return <div className="empty-state"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{text}</p>{action}</div>; }
function BackendGate({user,feature}:{user:Profile|null;feature:string}) { if (!backendConfigured) return <div className="inline-notice"><AlertCircle size={17}/><span><b>Backend setup needed.</b> {feature} becomes available after the Supabase setup in Settings.</span><Link to="/settings">Setup <ArrowRight size={14}/></Link></div>; if (!user) return <div className="inline-notice"><LockKeyhole size={17}/><span><b>Sign in to continue.</b> Your campus account keeps this space secure.</span><Link to="/auth">Sign in <ArrowRight size={14}/></Link></div>; return null; }

function Welcome({user}:{user:Profile|null}) { const navigate=useNavigate(); return <div className="welcome-page">
  <section className="welcome-hero">
    <div className="welcome-copy"><div className="eyebrow"><span className="eyebrow-dot"/> A calmer campus, together</div><h1>Your academic<br/><em>life, in flow.</em></h1><p className="hero-description">One thoughtful space for class notes, campus conversations and the people who make learning better.</p>
      <div className="hero-ctas">{user?<button className="button button-primary" onClick={()=>navigate('/dashboard')}>Go to your dashboard <ArrowRight size={16}/></button>:<><button className="button button-primary" onClick={()=>navigate('/auth?mode=signup')}>Create your account <ArrowRight size={16}/></button><button className="button button-secondary" onClick={()=>navigate('/auth')}>Log in</button></>}</div>
      <div className="hero-note"><span className="note-avatars"><i>R</i><i>A</i><i>M</i></span><span>Made for your campus community</span><span className="note-dot"/></div>
    </div>
    <div className="hero-art" aria-label="ClassFlow study space illustration">
      <div className="art-glow"/><div className="art-window">
        <div className="art-window-top"><span className="art-brand">ClassFlow</span><span className="art-user">Your campus <span className="art-avatar">A</span></span></div>
        <div className="broadcast-card"><div className="card-kicker"><Megaphone size={12}/> CAMPUS BROADCAST</div><div className="broadcast-row"><span className="priority-mark">!</span><div><b>Welcome to your academic hub</b><small>Stay close to everything happening on campus</small></div></div><div className="broadcast-row muted"><span className="blue-mark"><CalendarDays size={13}/></span><div><b>New semester, fresh possibilities</b><small>Posted by your campus community</small></div></div></div>
        <div className="art-section-head">YOUR RECENT RESOURCES <span>View all <ArrowRight size={11}/></span></div><div className="art-files"><div className="art-file"><FileText size={17}/><b>Course notes</b><small>Shared with your class</small></div><div className="art-file"><BookMarked size={17}/><b>Study guides</b><small>Made for your semester</small></div><div className="art-file"><CalendarDays size={17}/><b>Class schedule</b><small>Always within reach</small></div></div>
        <div className="art-bottom"><span className="art-tab active"><Home size={15}/></span><span className="art-tab"><Library size={15}/></span><span className="art-tab"><MessageCircle size={15}/></span><span className="art-tab"><UserRound size={15}/></span></div>
      </div><span className="floating-chip chip-resource"><span><FileText size={15}/></span> Notes, shared simply</span><span className="floating-chip chip-connection"><span><Users size={14}/></span> Your people, close by</span><span className="art-sparkle"><Sparkles size={17}/></span>
    </div>
  </section>
  <section className="welcome-under"><div className="welcome-under-heading"><div><div className="eyebrow">Everything in its place</div><h2>A little more room to learn.</h2></div><p>Thoughtfully made for all the moving parts of college life.</p></div><div className="feature-grid">
    <Feature icon={<Library size={19}/>} title="A living library" text="Find class notes, practicals and past papers shared by your campus."/><Feature icon={<MessageCircle size={19}/>} title="Your campus, connected" text="Stay in touch with classmates and keep useful conversations together."/><Feature icon={<Sparkles size={19}/>} title="Search with context" text="Look for the right study material by subject, semester and topic."/>
  </div></section>
  <footer className="site-footer"><span>© ClassFlow</span><span>Built for learning, shared with care.</span><Link to="/settings">Platform setup</Link></footer>
</div>; }
function Feature({icon,title,text}:{icon:React.ReactNode;title:string;text:string}) { return <article className="feature-card glass-panel"><span className="feature-icon">{icon}</span><h3>{title}</h3><p>{text}</p><ArrowRight size={15} className="feature-arrow"/></article>; }

function Dashboard({user}:{user:Profile|null}) {
  const notices = useQuery({queryKey:['notices'],enabled:!!supabase&&!!user,queryFn:async()=>{const {data,error}=await requireBackend().from('notices').select('id,title,body,priority,created_at,profiles:profiles!notices_author_id_fkey(full_name)').eq('is_published',true).order('created_at',{ascending:false}).limit(3);if(error)throw error;return data??[];}});
  const pinnedResources = useQuery({queryKey:['dashboard-pinned-resources'],enabled:!!supabase&&!!user,queryFn:async()=>{
    const db=requireBackend();
    const {data:pinned,error}=await db.from('resources').select('id,title,category,is_pinned,created_at,resource_files(id)').eq('is_published',true).eq('is_pinned',true).is('deleted_at',null).order('pinned_at',{ascending:false}).limit(6);
    if(error)throw error;
    if(pinned&&pinned.length>0)return pinned;
    const {data:recent,error:re}=await db.from('resources').select('id,title,category,is_pinned,created_at,resource_files(id)').eq('is_published',true).is('deleted_at',null).order('created_at',{ascending:false}).limit(3);
    if(re)throw re;
    return recent??[];
  }});
  return <><PageHeading eyebrow="YOUR ACADEMIC HUB" title={user?`Good to see you, ${user.full_name.split(' ')[0]}.`:'Your campus, in one place.'} description="A quieter space for the things that help you move forward." action={<button className="button button-secondary compact" onClick={()=>toast('Campus notifications are not configured in this deployment yet.')}><Bell size={15}/> Notifications</button>}/>
    <div className="dashboard-grid">
      <section className="dashboard-main-col">
        <div className="section-title-row"><div><div className="eyebrow">STAY IN THE LOOP</div><h2>Campus broadcast</h2></div><span className="muted-hint">Latest campus updates</span></div>
        <div className="broadcast-panel glass-panel">{notices.data?.length ? notices.data.map((n:any)=><div className="notice-item" key={n.id}><span className={`notice-symbol ${n.priority==='urgent'?'urgent':''}`}>{n.priority==='urgent'?'!':<Megaphone size={15}/>}</span><div className="notice-copy"><b>{n.title}</b><p>{n.body}</p><small>Posted by {n.profiles?.full_name||'Campus admin'} · {relativeTime(n.created_at)}</small></div><MoreHorizontal size={17} className="notice-more"/></div>) : <div className="broadcast-empty"><span className="soft-icon"><Megaphone size={17}/></span><div><b>{notices.isLoading?'Gathering campus updates…':'Your campus bulletin'}</b><p>{backendConfigured&&user?'Published notices will find a home here.':'Connect your campus to see official updates and announcements.'}</p></div></div>}</div>
        <div className="section-title-row section-spaced"><div><div className="eyebrow" style={{display:'flex',alignItems:'center',gap:'4px'}}><Pin size={11} fill="currentColor"/> {pinnedResources.data?.some((r:any)=>r.is_pinned)?'CAMPUS PINNED':'FEATURED RESOURCES'}</div><h2>Pinned resources</h2></div><Link to="/library" className="text-button">Browse library <ArrowRight size={14}/></Link></div>
        <ResourceRow resources={pinnedResources.data??[]} loading={pinnedResources.isLoading}/>
      </section>
      <aside className="dashboard-side-col">
        <div className="welcome-small-card glass-panel"><div className="small-card-top"><span className="mini-orb"><Sparkles size={18}/></span><span className="small-label">CLASSFLOW COPILOT</span></div><h3>Find what you need<br/>for your next class.</h3><p>Search original study material from your campus by topic, subject or semester.</p><Link to="/copilot" className="button button-primary full-button">Ask Copilot <Search size={15}/></Link></div>
        <div className="stats-card glass-panel"><div className="section-title-row tight"><div><div className="eyebrow">YOUR ACADEMIC RHYTHM</div><h2>Quick stats</h2></div><Activity size={17}/></div><div className="stat-row"><span className="stat-ring sage-ring"><BookOpen size={16}/></span><span><b>Resources saved</b><small>Personal collection</small></span><strong>—</strong></div><div className="stat-row"><span className="stat-ring sand-ring"><CalendarDays size={16}/></span><span><b>Upcoming classes</b><small>Your schedule</small></span><strong>—</strong></div><div className="stat-row"><span className="stat-ring mauve-ring"><Users size={16}/></span><span><b>Campus connections</b><small>Friends & groups</small></span><strong>—</strong></div></div>
      </aside>
    </div>
    {(!backendConfigured||!user)&&<div className="dashboard-connect glass-panel"><span className="connect-spark"><GraduationCap size={20}/></span><div><b>Make this space yours</b><p>Set up your campus connection and sign in to bring your classes, people and resources together.</p></div><Link to={backendConfigured?'/auth':'/settings'} className="button button-secondary compact">{backendConfigured?'Get started':'Setup guide'} <ArrowRight size={14}/></Link></div>}
  </>;
}
function ResourceRow({resources,loading}:{resources:any[];loading:boolean}) { if (loading) return <div className="resource-row"><div className="skeleton-card"/><div className="skeleton-card"/><div className="skeleton-card"/></div>; if (!resources.length) return <div className="empty-card"><span className="soft-icon"><BookOpen size={17}/></span><div><b>No pinned resources to show just yet</b><p>Campus admins and subadmins can pin important class documents from the library.</p></div><Link to="/library" className="text-button">Browse library <ArrowRight size={14}/></Link></div>; return <div className="resource-row">{resources.map(r=><Link to={`/library?resource=${r.id}`} className="resource-tile glass-panel" key={r.id}><span className="resource-file-icon">{r.is_pinned?<Pin size={15} fill="#f59e0b" color="#f59e0b"/>:<FileText size={17}/>}</span><span className="resource-tile-title">{r.title}</span><small>{r.category}{r.is_pinned?' · 📌 Pinned':''} · {r.resource_files?.length||0} files</small><span className="tile-arrow"><ArrowRight size={13}/></span></Link>)}</div>; }

function LibraryPage({user}:{user:Profile|null}) {
  const [q,setQ]=useState('');const safeQuery=q.trim().replace(/[^\p{L}\p{N}\s_-]/gu,''); const [category,setCategory]=useState(''); const [sort,setSort]=useState('newest'); const [filterOpen,setFilterOpen]=useState(false);const [branchFilter,setBranchFilter]=useState('');const [semesterFilter,setSemesterFilter]=useState('');const [subjectFilter,setSubjectFilter]=useState('');
  const filterBranches=useQuery({queryKey:['branches'],enabled:!!supabase&&!!user,queryFn:async()=>{const {data,error}=await requireBackend().from('branches').select('id,name').eq('is_active',true).order('name');if(error)throw error;return data??[];}});
  const filterSemesters=useQuery({queryKey:['semesters'],enabled:!!supabase&&!!user,queryFn:async()=>{const {data,error}=await requireBackend().from('semesters').select('id,name,number').eq('is_active',true).order('number');if(error)throw error;return data??[];}});
  const filterSubjects=useQuery({queryKey:['library-subjects',branchFilter,semesterFilter],enabled:!!supabase&&!!user,queryFn:async()=>{let q=requireBackend().from('subjects').select('id,name,branch_id,semester_id').eq('is_active',true).order('name');if(branchFilter)q=q.eq('branch_id',branchFilter);if(semesterFilter)q=q.eq('semester_id',semesterFilter);const {data,error}=await q;if(error)throw error;return data??[];}});
  const query=useQuery({queryKey:['resources',q,category,sort,branchFilter,semesterFilter,subjectFilter],enabled:!!supabase&&!!user,queryFn:async()=>{let request=requireBackend().from('resources').select('id,title,description,category,assignment_type,branch_id,semester_id,subject_id,unit_module,tags,page_count,external_url,created_at,updated_at,profiles:profiles!resources_uploaded_by_fkey(full_name,classflow_id),subject:subjects!resources_subject_id_fkey(name),branch:branches!resources_branch_id_fkey(name),semester:semesters!resources_semester_id_fkey(name),resource_files(id,original_name,mime_type,size_bytes,storage_path)').eq('is_published',true).is('deleted_at',null).is('resource_files.deleted_at',null);if(safeQuery) request=request.or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%,unit_module.ilike.%${safeQuery}%`);if(category)request=request.eq('category',category);if(branchFilter)request=request.or(`branch_id.eq.${branchFilter},branch_id.is.null`);if(semesterFilter)request=request.or(`semester_id.eq.${semesterFilter},semester_id.is.null`);if(subjectFilter)request=request.or(`subject_id.eq.${subjectFilter},subject_id.is.null`);if(sort==='oldest')request=request.order('created_at',{ascending:true});else if(sort==='title')request=request.order('title',{ascending:true});else request=request.order('updated_at',{ascending:false});request=request.limit(60);const {data,error}=await request;if(error)throw error;const results=(data??[]) as unknown as Resource[];if(sort==='downloads'){const {data:counts,error:countError}=await requireBackend().rpc('resource_download_counts');if(countError)throw countError;const ranking=new Map<string,number>((counts??[]).map((row:any)=>[row.resource_id,Number(row.downloads)] as [string,number]));return results.sort((a,b)=>(ranking.get(b.id)||0)-(ranking.get(a.id)||0));}return results;}});
  return <><PageHeading eyebrow="SHARED KNOWLEDGE" title="Resource library" description="Useful material, thoughtfully shared by your campus." action={<Link to="/upload" className="button button-primary compact"><Plus size={16}/> Share resource</Link>}/>
    <div className="library-search-row"><div className="library-search"><Search size={17}/><input aria-label="Search resources" placeholder="Search notes, subjects, topics..." value={q} onChange={e=>setQ(e.target.value)}/>{q&&<button className="clear-search" onClick={()=>setQ('')}><X size={15}/></button>}</div><button className={`filter-button ${filterOpen?'pressed':''}`} onClick={()=>setFilterOpen(!filterOpen)}><Filter size={16}/> Filters <ChevronDown size={14}/></button><select className="sort-select" value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort resources"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="downloads">Most downloaded</option><option value="title">Alphabetical</option></select></div>
    {filterOpen&&<div className="filter-panel glass-panel"><span className="filter-label">CATEGORY</span><button className={`filter-chip ${category===''?'active':''}`} onClick={()=>setCategory('')}>All resources</button>{categories.map(c=><button key={c} className={`filter-chip ${category===c?'active':''}`} onClick={()=>setCategory(category===c?'':c)}>{c}</button>)}<span className="filter-label filter-break">ACADEMIC</span><select className="filter-select" value={branchFilter} onChange={e=>{setBranchFilter(e.target.value);setSubjectFilter('');}}><option value="">All branches</option>{filterBranches.data?.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select><select className="filter-select" value={semesterFilter} onChange={e=>{setSemesterFilter(e.target.value);setSubjectFilter('');}}><option value="">All semesters</option>{filterSemesters.data?.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select className="filter-select" value={subjectFilter} onChange={e=>setSubjectFilter(e.target.value)}><option value="">All subjects</option>{filterSubjects.data?.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
    <div className="library-subhead"><span>{query.data?.length??0} {query.data?.length===1?'resource':'resources'}</span><span>Shared knowledge, kept close</span></div>
    {query.isError&&<div className="inline-error"><AlertCircle size={16}/>Couldn’t load resources. Please try again in a moment.<button onClick={()=>void query.refetch()}>Retry</button></div>}
    {query.isLoading?<div className="resource-grid">{[1,2,3,4].map(i=><div className="skeleton-card library-skeleton" key={i}/>)}</div>:query.data?.length?<div className="resource-grid">{query.data.map(r=><ResourceCard resource={r} key={r.id} user={user}/>)}</div>:<DataState title={backendConfigured&&user?'No matching class material found.':'Your campus library is ready to grow'} text={backendConfigured&&user?'Try another search or category, or share a helpful resource with your classmates.':'After connecting your campus, find notes, assignments, practicals and more in one place.'} icon={<BookOpen size={22}/>} action={<Link to={backendConfigured&&user?'/upload':'/settings'} className="button button-secondary compact">{backendConfigured&&user?'Share a resource':'Connect your campus'} <ArrowRight size={14}/></Link>}/>}
  </>;
}
function ResourceCard({resource:r,user}:{resource:Resource;user:Profile|null}) {
  const [busy,setBusy]=useState(false);const [saved,setSaved]=useState(false);const [coverUrl,setCoverUrl]=useState<string|null>(null);const [isPinned,setIsPinned]=useState(Boolean(r.is_pinned));const queryClient=useQueryClient();
  const own=r.profiles?.classflow_id===user?.classflow_id;
  const canPin=user?.role==='admin'||user?.role==='subadmin';
  const canManage=own||user?.role==='admin'||Boolean(user?.permissions?.some(p=>['resources.manage','resources.edit'].includes(p)));
  const canDelete=own||user?.role==='admin'||Boolean(user?.permissions?.some(p=>['resources.manage','resources.delete'].includes(p)));
  useEffect(()=>{setIsPinned(Boolean(r.is_pinned));},[r.is_pinned]);
  useEffect(()=>{if(!supabase||!user)return;void requireBackend().from('bookmarks').select('resource_id').eq('resource_id',r.id).eq('user_id',user.id).maybeSingle().then(({data})=>setSaved(Boolean(data)));},[r.id,user?.id]);
  const isImageFile=(file:any)=>file?.mime_type?.toLowerCase().startsWith('image/')||/\.(png|jpe?g|gif|webp)$/i.test(file?.original_name||'');
  const coverFile=r.resource_files?.find(isImageFile)||r.resource_files?.[0];
  useEffect(()=>{let cancelled=false;if(!coverFile||!isImageFile(coverFile)||!supabase||!user){setCoverUrl(null);return;}void requireBackend().storage.from('classflow-resources').createSignedUrl(coverFile.storage_path,600).then(({data,error})=>{if(!cancelled)setCoverUrl(error?null:data?.signedUrl||null);}).catch(()=>{if(!cancelled)setCoverUrl(null);});return()=>{cancelled=true;};},[coverFile?.storage_path,user?.id]);
  const iconFor=(f:string)=>{const ext=f.split('.').pop()?.toLowerCase();return ext==='zip'?<FileArchive size={17}/>:['png','jpg','jpeg','gif','webp'].includes(ext||'')?<FileImage size={17}/>:<FileText size={17}/>;};
  async function signedUrl(file:{original_name:string;storage_path:string},downloadFile:boolean){if(!supabase)return null;const {data,error}=await requireBackend().storage.from('classflow-resources').createSignedUrl(file.storage_path,60,downloadFile?{download:file.original_name}:{});if(error)throw error;return data.signedUrl;}
  async function download(file:{original_name:string;storage_path:string}){setBusy(true);try{const url=await signedUrl(file,true);if(url){if(user)await requireBackend().from('resource_downloads').insert({resource_id:r.id,user_id:user.id});const a=document.createElement('a');a.href=url;a.download=file.original_name;a.rel='noreferrer';a.click();}}catch(e){toast(e instanceof Error?e.message:'Download could not be prepared.');}finally{setBusy(false);}}
  async function preview(file:{original_name:string;storage_path:string}){const previewWindow=window.open('about:blank','_blank');if(previewWindow)previewWindow.opener=null;setBusy(true);try{const url=await signedUrl(file,false);if(url){if(previewWindow)previewWindow.location.href=url;else window.location.assign(url);}else previewWindow?.close();}catch(e){previewWindow?.close();toast(e instanceof Error?e.message:'Preview could not be prepared.');}finally{setBusy(false);}}
  async function toggleBookmark(){if(!supabase||!user){toast('Sign in to save resources to your collection.');return;}const db=requireBackend();const response=saved?await db.from('bookmarks').delete().eq('resource_id',r.id).eq('user_id',user.id):await db.from('bookmarks').insert({resource_id:r.id,user_id:user.id});if(response.error){toast(response.error.message);return;}setSaved(!saved);await queryClient.invalidateQueries({queryKey:['dashboard-resources']});toast(saved?'Removed from saved resources.':'Saved to your collection.');}
  async function togglePin(){
    if(!supabase||!user||!canPin)return;
    try{
      const {data,error}=await requireBackend().rpc('toggle_pin_resource',{target_resource_id:r.id});
      if(error)throw error;
      setIsPinned(Boolean(data));
      await Promise.all([
        queryClient.invalidateQueries({queryKey:['resources']}),
        queryClient.invalidateQueries({queryKey:['dashboard-pinned-resources']}),
        queryClient.invalidateQueries({queryKey:['admin-resources']}),
      ]);
      toast(data?'Resource pinned to campus front page! 📌':'Resource unpinned from front page.');
    }catch(err){
      toast(err instanceof Error?err.message:'Could not update pin state.');
    }
  }
  async function removeResource(){if(!supabase||!user||!canDelete||!window.confirm('Move this resource to the campus archive? You can ask an administrator to restore it.'))return;const {error}=await requireBackend().from('resources').update({deleted_at:new Date().toISOString()}).eq('id',r.id);if(error){toast(error.message);return;}await queryClient.invalidateQueries({queryKey:['resources']});toast('Resource archived.');}
  const first=r.resource_files?.[0];const isImage=Boolean(coverFile&&isImageFile(coverFile));
  return <motion.article layout initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="resource-card glass-panel">
    <div className="resource-cover">
      {isPinned&&<span className="resource-cover-pinned"><Pin size={11} fill="currentColor"/> Pinned</span>}
      {coverUrl&&isImage?<button type="button" className="resource-cover-preview" aria-label={`Preview ${coverFile?.original_name}`} onClick={()=>coverFile&&void preview(coverFile)}><img src={coverUrl} alt={coverFile?.original_name||'Resource preview'} loading="lazy"/></button>:<div className={`resource-cover-placeholder ${isImage?'image-unavailable':''}`}><span className="cover-file-icon">{iconFor(coverFile?.original_name||'pdf')}</span><b>{isImage?'IMAGE PREVIEW':(coverFile?.mime_type?.split('/').pop()||'DOCUMENT').replace('vnd.','').replaceAll('.',' ').toUpperCase()}</b><small>{coverFile?.original_name||'No attached file'}</small></div>}
      <span className="resource-cover-category">{r.category}{r.assignment_type?` · ${r.assignment_type}`:''}</span>
      <button className={`resource-cover-bookmark ${saved?'saved':''}`} title={saved?'Remove bookmark':'Bookmark resource'} aria-label={saved?'Remove bookmark':'Bookmark resource'} onClick={()=>void toggleBookmark()}><Bookmark size={15} fill={saved?'currentColor':'none'}/></button>
      {(r.resource_files?.length||0)>1&&<span className="resource-cover-count">+{r.resource_files!.length-1} more</span>}
    </div>
    <div className="resource-card-body"><h3>{r.title}</h3><p className="resource-description">{r.description||'A class resource shared with the campus community.'}</p><div className="resource-meta"><span>{r.profiles?.full_name||'Campus member'}</span><i/><span>{relativeTime(r.created_at)}</span></div>
      <div className="resource-card-footer"><span className="file-count"><FileText size={13}/>{r.resource_files?.length??0} {r.resource_files?.length===1?'file':'files'}{r.page_count?` · ${r.page_count} pages`:''}</span><div className="resource-actions">{r.external_url&&<a href={r.external_url} target="_blank" rel="noreferrer" className="small-action" aria-label="Open cloud link" title="Open Google Drive / Cloud Link"><ExternalLink size={13}/>Drive</a>}{first&&<><button className="small-action" onClick={()=>void preview(first)} disabled={busy} aria-label="Preview resource"><Eye size={13}/>Preview</button><button className="small-action" onClick={()=>void download(first)} disabled={busy} aria-label="Download resource"><ArrowDownToLine size={13}/>{busy?'…':'Download'}</button></>}{canPin&&<button className={`small-action pin-action ${isPinned?'is-pinned':''}`} onClick={()=>void togglePin()} title={isPinned?'Unpin from front page':'Pin to campus front page'} aria-label={isPinned?'Unpin from home':'Pin to home'}>{isPinned?<PinOff size={13}/>:<Pin size={13}/>}{isPinned?'Pinned':'Pin'}</button>}{canManage&&<Link to={`/upload?edit=${r.id}`} className="small-action" aria-label="Edit resource"><Pencil size={14}/></Link>}{canDelete&&<button className="small-action danger-action" aria-label="Archive resource" onClick={()=>void removeResource()}><Trash2 size={13}/></button>}</div></div>
      {r.resource_files?.length?<details className="attached-files"><summary>{r.resource_files.length} attached {r.resource_files.length===1?'file':'files'} <ChevronDown size={12}/></summary><div>{r.resource_files.map(f=><button key={f.id} onClick={()=>void download(f)}><span className="attached-file-icon">{iconFor(f.original_name)}</span><span>{f.original_name}</span><small>{prettySize(f.size_bytes)}</small><ArrowDownToLine size={13}/></button>)}</div></details>:null}
    </div>
  </motion.article>;
}
function CopilotPage({user}:{user:Profile|null}) {
  const [question,setQuestion]=useState('');const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [result,setResult]=useState<any|null>(null);const [history,setHistory]=useState<string[]>([]);
  async function ask(e:FormEvent){
    e.preventDefault();
    const text=question.trim();
    if(text.length<2){setError('Enter a little more to search or ask.');return;}
    setLoading(true);setError('');
    try {
      let data:any=null;
      // Tier 1: Call Supabase edge function
      if(supabase&&user){
        try{
          const {data:edgeData,error:edgeErr}=await requireBackend().functions.invoke('copilot',{body:{query:text}});
          if(!edgeErr&&edgeData?.answer){
            data=edgeData;
          }
        }catch(e){
          console.warn('Edge function invoke skipped:',e);
        }
      }

      // Tier 2: Resilient Free AI engine (Pollinations OpenAI format, unlimited 10k+ requests/day free)
      if(!data||!data.answer){
        try{
          const sysPrompt="You are ClassFlow Copilot, an expert AI academic tutor for college and university students. Answer the student's question accurately, concisely, and helpfully with clear explanations, bullet points, and practical tips. Respond in the language used by the student (English, Hindi, or Hinglish).";
          const aiResp=await fetch('https://text.pollinations.ai/openai/chat/completions',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
              model:'openai',
              temperature:0.35,
              max_tokens:1200,
              messages:[
                {role:'system',content:sysPrompt},
                {role:'user',content:text}
              ]
            })
          });
          if(aiResp.ok){
            const aiJson=await aiResp.json();
            const content=aiJson.choices?.[0]?.message?.content;
            if(content&&typeof content==='string'&&content.trim()){
              let campusMatches:any[]=[];
              try{
                if(supabase){
                  const cleanTerms=text.replace(/[^\w\s]/g,' ').split(/\s+/).filter(t=>t.length>2).slice(0,3);
                  if(cleanTerms.length>0){
                    const orClauses=cleanTerms.map(t=>`title.ilike.%${t}%,description.ilike.%${t}%,unit_module.ilike.%${t}%`).join(',');
                    const {data:found}=await requireBackend().from('resources')
                      .select('id, title, description, category, unit_module, external_url, resource_files(id, original_name, mime_type, size_bytes, storage_path)')
                      .or(orClauses)
                      .eq('is_published',true)
                      .is('deleted_at',null)
                      .limit(4);
                    campusMatches=(found??[]).map(r=>({
                      id:r.id,
                      title:r.title,
                      description:r.description,
                      category:r.category,
                      unit_module:r.unit_module,
                      external_url:r.external_url,
                      files:(r.resource_files||[]).map((f:any)=>({id:f.id,name:f.original_name,mime_type:f.mime_type,size_bytes:f.size_bytes}))
                    }));
                  }
                }
              }catch(e){}
              data={
                route:campusMatches.length>0?'academic':'general',
                answer:content.trim(),
                matches:campusMatches,
              };
            }
          }
        }catch(e){
          console.error('Free AI tier error:',e);
        }
      }

      if(data&&data.answer){
        setResult(data);
        setHistory(old=>[text,...old.filter(h=>h!==text)].slice(0,5));
        setQuestion('');
      } else {
        throw new Error('Could not connect to AI tutor. Please check your internet connection.');
      }
    } catch(err) {
      setError(err instanceof Error?err.message:'Copilot could not complete that request. Please try again.');
    } finally {
      setLoading(false);
    }
  }
  const suggestions=['Find notes on data structures','Show me semester 3 PYQs','Explain binary search trees with an example','Ohm\'s law and circuit formulas'];
  return <><PageHeading eyebrow="AI ACADEMIC COPILOT" title="ClassFlow Copilot" description="Ask any study question or search your campus library. Copilot gives you smart explanations and links to class notes."/><BackendGate user={user} feature="AI-powered academic search"/>
    <div className="copilot-shell"><div className="copilot-intro"><span className="copilot-orb"><Sparkles size={21}/></span><div><b>What do you need help with?</b><p>Ask concept questions, formulas, or search for campus notes and PYQs.</p></div><span className="route-chip"><i/> AI + Campus Library</span></div>
      <form className="copilot-form" onSubmit={ask}><Search size={18}/><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="e.g. Explain recursion or find semester 3 notes" aria-label="Ask ClassFlow Copilot"/><button className="button button-primary compact" type="submit" disabled={loading}>{loading?<RefreshCw className="spin" size={15}/>:<>Ask <ArrowRight size={14}/></>}</button></form>
      {error&&<div className="copilot-error"><AlertCircle size={15}/>{error}</div>}
      {!result&&!loading&&<div className="suggestions"><span>TRY ASKING</span>{suggestions.map(s=><button key={s} onClick={()=>setQuestion(s)}>{s}<ArrowRight size={12}/></button>)}</div>}
      {loading&&<div className="copilot-loading"><span className="loading-pulse"><Sparkles size={17}/></span><div><b>Thinking & Searching…</b><small>Consulting AI tutor and scanning campus library materials.</small></div></div>}
      {result&&<section className="copilot-result"><div className="result-heading"><span className="result-route-icon">{result.matches?.length>0?<Library size={15}/>:<Sparkles size={15}/>}</span><div><span className="eyebrow">{result.matches?.length>0?'CAMPUS RESOURCES & AI TUTOR':'AI STUDY TUTOR'}</span><h2>{result.matches?.length>0?'Campus Notes & Concept Guide':'Study Explanation'}</h2></div><button className="text-button" onClick={()=>setResult(null)}>Clear <X size={13}/></button></div>
        {result.answer&&<div className="general-answer glass-panel"><div className="general-answer-header"><Sparkles size={16}/><span>ClassFlow Copilot AI Tutor</span></div><div className="general-answer-body readable-text"><p>{result.answer}</p></div><small className="general-answer-footer">AI academic response · Verify key syllabus requirements with your course faculty.</small></div>}
        {result.matches?.length>0&&<div style={{marginTop:'20px'}}><div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px',fontWeight:600}}><Library size={16}/><span>Campus Study Materials ({result.matches.length})</span></div><div className="copilot-matches">{result.matches.map((m:any)=><article className="copilot-match glass-panel" key={m.id||m.chunk_id}><div className="match-top"><span className="resource-file-icon"><FileText size={15}/></span><span className="category-pill">{m.category||m.resource_category||'Notes'}</span><span className="match-score">Campus Resource</span></div><h3>{m.title||m.resource_title}</h3><div className="match-meta"><span>{m.unit_module||m.subject_name||'General'}</span><i/><span>{m.uploader||m.uploader_name||'Campus member'}</span></div>{m.description&&<p className="match-excerpt">{m.description}</p>}{m.files?.length>0&&<div className="match-files">{m.files.map((f:any)=><a key={f.id} href={f.signed_url||undefined} target="_blank" rel="noreferrer" className={!f.signed_url?'disabled':''}><FileText size={13}/>{f.name}{f.size_bytes?<small>{prettySize(f.size_bytes)}</small>:null}<ArrowDownToLine size={13}/></a>)}</div>}{m.external_url&&<div style={{marginTop:'8px'}}><a href={m.external_url} target="_blank" rel="noreferrer" className="text-button" style={{fontSize:'13px',display:'inline-flex',alignItems:'center',gap:'4px'}}>Open Cloud / Drive Link <ExternalLink size={13}/></a></div>}</article>)}</div></div>}
      </section>}
      {history.length>0&&<div className="copilot-history"><span>RECENT SEARCHES</span>{history.map((h,i)=><button key={`${h}-${i}`} onClick={()=>setQuestion(h)}><Clock3 size={12}/>{h}<ArrowUpRightIcon/></button>)}</div>}
    </div><div className="copilot-footnote"><ShieldCheck size={14}/><span>Document retrieval provides direct access to campus files. General explanations are AI-generated for student assistance.</span></div>
  </>;
}
function ArrowUpRightIcon(){return <ArrowRight size={12}/>;}

function UploadPage({user}:{user:Profile|null}) {
  const queryClient=useQueryClient();const location=useLocation();const editId=new URLSearchParams(location.search).get('edit');const [editLoaded,setEditLoaded]=useState(false);
  const [files,setFiles]=useState<File[]>([]);const [category,setCategory]=useState('Notes');const [assignment,setAssignment]=useState('');const [title,setTitle]=useState('');const [description,setDescription]=useState('');const [unit,setUnit]=useState('');const [tags,setTags]=useState('');const [pageCount,setPageCount]=useState('');const [externalUrl,setExternalUrl]=useState('');const [progress,setProgress]=useState<Record<string,number>>({});const [status,setStatus]=useState('idle');const [errors,setErrors]=useState<string[]>([]);const [stage,setStage]=useState(editId?2:1);const [sharedNotice,setSharedNotice]=useState<string|null>(null);const [uploadSummary,setUploadSummary]=useState<{done:number;failed:string[]}|null>(null);const [retryResourceId,setRetryResourceId]=useState<string|null>(null);const [replaceTargets,setReplaceTargets]=useState<Record<string,string>>({});const activeUpload=useRef<AbortController|null>(null);const cancelUpload=useRef(false);const overallProgress=files.length?Math.round(files.reduce((sum,file)=>sum+(progress[fileKey(file)]||0)*file.size,0)/files.reduce((sum,file)=>sum+file.size,0)):0;
  const existingResource=useQuery({queryKey:['resource-edit',editId],enabled:!!editId&&!!supabase&&!!user,queryFn:async()=>{const {data,error}=await requireBackend().from('resources').select('id,title,description,category,assignment_type,unit_module,tags,page_count,external_url,resource_files(id,original_name,mime_type,size_bytes,storage_path)').eq('id',editId!).is('deleted_at',null).is('resource_files.deleted_at',null).single();if(error)throw error;return data as any;}});
  useEffect(()=>{const r=existingResource.data;if(!r||editLoaded)return;setTitle(r.title);setDescription(r.description||'');setCategory(r.category);setAssignment(r.assignment_type||'');setUnit(r.unit_module||'');setTags((r.tags||[]).join(', '));setPageCount(r.page_count?String(r.page_count):'');setExternalUrl(r.external_url||'');setStage(2);setEditLoaded(true);},[existingResource.data,editLoaded]);
  useEffect(()=>{
    const params=new URLSearchParams(location.search);
    const sharedTitle=params.get('title');const sharedText=params.get('text');const sharedUrl=params.get('url');
    if(sharedTitle)setTitle(t=>t||sharedTitle);
    if(sharedText)setDescription(d=>d||sharedText);
    if(sharedUrl)setExternalUrl(u=>u||sharedUrl);
    if(params.get('shared')==='1'){
      void getAndClearSharedData().then(data=>{
        if(!data)return;
        if(data.title)setTitle(t=>t||data.title||'');
        if(data.text)setDescription(d=>d||data.text||'');
        if(data.url)setExternalUrl(u=>u||data.url||'');
        if(data.files&&data.files.length>0){
          void appendFiles(data.files);
          const firstFileName=data.files[0].name.replace(/\.[^/.]+$/,'');
          setTitle(t=>t||firstFileName);
          setSharedNotice(`${data.files.length} file(s) received from your device share!`);
          toast(`${data.files.length} file(s) received from share sheet!`);
        }
      });
    }
  },[location.search]);
  const appendFiles=async(input:File[])=>{const valid:File[]=[];const errs:string[]=[];for(const raw of input){const f=await compressImageIfNeeded(raw);const issue=validateResourceFile(f);if(issue){errs.push(issue);continue;}valid.push(f);}setFiles(old=>{const seen=new Set(old.map(f=>`${f.name}:${f.size}:${f.lastModified}`));return [...old,...valid.filter(f=>!seen.has(`${f.name}:${f.size}:${f.lastModified}`))];});setErrors(errs);};
  const onFiles=(e:ChangeEvent<HTMLInputElement>)=>{void appendFiles(Array.from(e.target.files||[]));e.target.value='';};
  const removeFile=(i:number)=>setFiles(old=>old.filter((_,idx)=>idx!==i));
  const setReplacement=(fileId:string,file?:File)=>{if(!file)return;const issue=validateResourceFile(file);if(issue){setErrors([issue]);return;}void appendFiles([file]);setReplaceTargets(old=>({...old,[`${file.name}:${file.size}:${file.lastModified}`]:fileId}));};
  async function removeExistingFile(fileId:string){if(!editId||!supabase||!window.confirm('Remove this file from the resource? The previous file version will be retained in private storage history.'))return;const {error}=await requireBackend().from('resource_files').update({deleted_at:new Date().toISOString()}).eq('id',fileId).eq('resource_id',editId);if(error){toast(error.message);return;}await existingResource.refetch();await queryClient.invalidateQueries({queryKey:['resources']});toast('File removed. The previous version remains in history.');}
  const validateStep=()=>{const fileIssues=(files.length||editId||retryResourceId||externalUrl.trim())?[]:['Select at least one file or enter a cloud drive link to continue.'];const checked=resourceMetadataSchema.safeParse({title,category,assignmentType:assignment,pageCount});const issues=[...fileIssues,...(checked.success?[]:checked.error.issues.map(issue=>issue.message))];setErrors([...new Set(issues)]);return !issues.length;};
  async function submit(e:FormEvent) { e.preventDefault(); if(!validateStep())return; if(!user){toast('Please sign in before sharing resources.');return;} setStatus('uploading');cancelUpload.current=false;setUploadSummary(null);setProgress({});const db=requireBackend();let resourceId:string|null=retryResourceId||editId;const failures:string[]=[];const failedFiles:File[]=[];let completed=0;
    try {
      if(!resourceId){const {data:created,error:createError}=await db.from('resources').insert({title:title.trim(),description:description.trim()||null,category,assignment_type:category==='Assignment'?assignment:null,branch_id:null,semester_id:null,subject_id:null,unit_module:unit.trim()||null,tags:tags.split(',').map(s=>s.trim()).filter(Boolean),page_count:pageCount?Number(pageCount):null,external_url:externalUrl.trim()||null,uploaded_by:user.id,is_published:true}).select('id').single();if(createError)throw createError;resourceId=created.id;}else{const {error:updateError}=await db.from('resources').update({title:title.trim(),description:description.trim()||null,category,assignment_type:category==='Assignment'?assignment:null,unit_module:unit.trim()||null,tags:tags.split(',').map(s=>s.trim()).filter(Boolean),page_count:pageCount?Number(pageCount):null,external_url:externalUrl.trim()||null}).eq('id',resourceId);if(updateError)throw updateError;}
      for(const file of files){if(cancelUpload.current){failures.push(`${file.name}: Upload cancelled before starting.`);failedFiles.push(file);continue;}const path=`${user.id}/${resourceId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\- ]/g,'_')}`;const controller=new AbortController();activeUpload.current=controller;try{await uploadPrivateResourceFile(db,file,path,pct=>setProgress(p=>({...p,[fileKey(file)]:pct})),controller.signal);const {error:metaError}=await db.from('resource_files').insert({resource_id:resourceId,original_name:file.name,storage_path:path,mime_type:resourceMimeType(file),size_bytes:file.size,uploaded_by:user.id,replaces_file_id:replaceTargets[fileKey(file)]||null});if(metaError){await db.storage.from('classflow-resources').remove([path]);throw metaError;}const replaced=replaceTargets[fileKey(file)];if(replaced){const {error:retireError}=await db.from('resource_files').update({deleted_at:new Date().toISOString()}).eq('id',replaced).eq('resource_id',resourceId);if(retireError)toast('New file uploaded, but the previous version could not be retired.');}completed++;}catch(err){await db.storage.from('classflow-resources').remove([path]);setProgress(p=>({...p,[fileKey(file)]:0}));failures.push(`${file.name}: ${err instanceof Error?err.message:'Upload failed'}`);failedFiles.push(file);}finally{activeUpload.current=null;}}
      if(completed>0&&resourceId){await queryClient.invalidateQueries({queryKey:['resources']});const {data:indexData,error:indexError}=await db.functions.invoke('index-resource',{body:{resource_id:resourceId}});if(indexError||indexData?.error)toast('Resource saved. AI document indexing needs server-side document parser and embedding credentials.');}
      if(completed===0&&files.length>0){if(!retryResourceId&&!editId&&resourceId)await db.from('resources').update({deleted_at:new Date().toISOString()}).eq('id',resourceId);setStatus('error');setErrors(failures.length?failures:['No files were uploaded.']);setFiles(failedFiles);}
      else if(failures.length){setUploadSummary({done:completed,failed:failures});setStatus('partial');setFiles(failedFiles);const failedKeys=new Set(failedFiles.map(fileKey));setReplaceTargets(old=>Object.fromEntries(Object.entries(old).filter(([key])=>failedKeys.has(key))));setRetryResourceId(resourceId);setErrors(failures);}
      else {setUploadSummary({done:completed,failed:[]});setStatus('success');setFiles([]);setRetryResourceId(null);setErrors([]);}
    }catch(err){setStatus('error');setErrors([err instanceof Error?err.message:'Could not create this resource.']);if(resourceId&&!retryResourceId)await db.from('resources').update({deleted_at:new Date().toISOString()}).eq('id',resourceId);}
  }
  const gate=<BackendGate user={user} feature="Secure resource publishing"/>;
  return <><PageHeading eyebrow={editId?'RESOURCE MANAGEMENT':'SHARE WHAT HELPS'} title={editId?'Edit your resource':'Share a resource'} description={editId?'Update the details or add more files to a resource you shared.':'Good class material gets better when it finds the right people.'}/>{gate&&<div className="gate-spacing">{gate}</div>}
    {sharedNotice&&<div style={{display:'flex',alignItems:'center',gap:'8px',padding:'12px 16px',background:'rgba(37,99,235,0.08)',border:'1px solid rgba(37,99,235,0.25)',color:'var(--brand,#2563eb)',borderRadius:'12px',marginBottom:'16px',fontSize:'13.5px',fontWeight:500}}><CheckCircle2 size={16}/><span>{sharedNotice}</span></div>}
    <div className="upload-layout"><form className="upload-form glass-panel" onSubmit={submit}>
      <div className="stepper"><div className={`step ${stage>=1?'current':''}`}><span>01</span><b>Files</b></div><i/><div className={`step ${stage>=2?'current':''}`}><span>02</span><b>Details</b></div><i/><div className={`step ${stage>=3?'current':''}`}><span>03</span><b>Review</b></div></div>
      {stage===1&&<section className="form-stage"><div className="form-section-title"><div><h2>Start with your files</h2><p>Add class documents, or link a Google Drive / Cloud folder.</p></div><span className="step-count">01 / 03</span></div>
        <label className="drop-zone" htmlFor="resource-files" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void appendFiles(Array.from(e.dataTransfer.files));}}><input id="resource-files" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp,.gif,.zip" onChange={onFiles}/><span className="drop-icon"><CloudUpload size={22}/></span><b>Drop documents here, or <em>browse files</em></b><small>PDF, Office files, images, text or ZIP · auto-compressed for lightning speed</small></label>
        <div style={{marginTop:'12px'}}><label className="field full" style={{margin:0}}><span>Or attach Google Drive / Cloud Link <small>(optional — unlimited storage for 50MB+ files or folders)</small></span><input value={externalUrl} onChange={e=>setExternalUrl(e.target.value)} placeholder="e.g. https://drive.google.com/... or OneDrive, Mega link"/></label></div>
        {files.length>0&&<div className="selected-files"><div className="selected-files-head"><b>{files.length} selected {files.length===1?'file':'files'}</b><button type="button" className="subtle-action" onClick={()=>setFiles([])}>Clear all</button></div>{files.map((f,i)=><div className="selected-file" key={`${f.name}-${f.lastModified}`}><span className="file-mini-icon"><FileText size={16}/></span><div className="selected-file-copy"><b>{f.name}</b><small>{prettySize(f.size)} · {f.type||'Document'}</small>{progress[fileKey(f)]!==undefined&&<span className="progress-track"><i style={{width:`${progress[fileKey(f)]}%`}}/></span>}</div><span className="file-state">{progress[fileKey(f)]===100?<CheckCircle2 size={16}/>:<button type="button" title="Remove file" onClick={()=>removeFile(i)}><X size={15}/></button>}</span></div>)}</div>}
        <div className="stage-actions"><span className="muted-hint">Files are stored securely and shared with your campus community.</span><button type="button" className="button button-primary" disabled={!files.length&&!externalUrl.trim()} onClick={()=>{if(files.length||externalUrl.trim()){setErrors([]);setStage(2);}}}>Add resource details <ArrowRight size={15}/></button></div>
      </section>}
      {stage===2&&<section className="form-stage"><div className="form-section-title"><div><h2>{editId?'Update resource details':'Tell us about it'}</h2><p>Add course details in the description so classmates can find it.</p></div><span className="step-count">02 / 03</span></div>
        <div className="form-grid"><label className="field full"><span>Resource title <b>*</b></span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Data Structures — Trees & Graphs" maxLength={160}/></label>
          <label className="field"><span>Resource category <b>*</b></span><select value={category} onChange={e=>{setCategory(e.target.value);setAssignment('');}}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
          {category==='Assignment'&&<label className="field"><span>Assignment type <b>*</b></span><select value={assignment} onChange={e=>setAssignment(e.target.value)}><option value="">Select assignment</option><option>Assignment 1</option><option>Assignment 2</option><option>Other Assignment</option></select></label>}
          <label className="field"><span>Unit / module <small>(optional)</small></span><input value={unit} onChange={e=>setUnit(e.target.value)} placeholder="e.g. Module 3 — Trees" maxLength={100}/></label>
          <label className="field full"><span>Description <small>(optional)</small></span><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Add the course, branch, semester, subject, and a short summary here if useful." rows={4} maxLength={2000}/><small className="field-help">{description.length}/2000</small></label>
          <label className="field"><span>Tags <small>(optional)</small></span><input value={tags} onChange={e=>setTags(e.target.value)} placeholder="e.g. exam prep, recursion"/><small className="field-help">Separate tags with commas.</small></label>
          <label className="field"><span>Page count <small>(optional metadata)</small></span><input type="number" min="1" max="10000" value={pageCount} onChange={e=>setPageCount(e.target.value)} placeholder="e.g. 24"/><small className="field-help">Metadata only; does not modify the document.</small></label>
        </div>{editId&&<label className="edit-add-files" htmlFor="extra-resource-files" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();appendFiles(Array.from(e.dataTransfer.files));}}><input id="extra-resource-files" type="file" multiple hidden accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp,.gif,.zip" onChange={onFiles}/><FilePlus2 size={16}/> Add more files or drop replacements here</label>}{editId&&(existingResource.data?.resource_files||[]).length>0&&<div className="existing-files-list"><div className="selected-files-head"><b>Files already in this resource</b><span className="muted-hint">Removing a file keeps its prior version in history.</span></div>{(existingResource.data?.resource_files||[]).map((f:any)=><div className="selected-file" key={f.id}><span className="file-mini-icon"><FileText size={15}/></span><div className="selected-file-copy"><b>{f.original_name}</b><small>{prettySize(f.size_bytes)} · {f.mime_type}</small></div><label className="small-action replace-file-action"><RefreshCw size={13}/> Replace<input type="file" hidden accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp,.gif,.zip" onChange={e=>setReplacement(f.id,e.target.files?.[0])}/></label><button type="button" className="small-action danger-action" onClick={()=>void removeExistingFile(f.id)}><Trash2 size={13}/> Remove</button></div>)}</div>}<div className="stage-actions"><button type="button" className="button button-secondary" onClick={()=>{setStage(editId?2:1);setErrors([]);}}><ArrowLeft size={15}/> {editId?'Stay in details':'Back to files'}</button><button type="button" className="button button-primary" onClick={()=>{if(validateStep())setStage(3);}}>Review resource <ArrowRight size={15}/></button></div>
      </section>}
      {stage===3&&<section className="form-stage"><div className="form-section-title"><div><h2>{editId?'Review your changes':'Take a final look'}</h2><p>Everything look right? You can return to edit any detail.</p></div><span className="step-count">03 / 03</span></div><div className="review-card"><div className="review-main"><span className="resource-file-icon large"><FileText size={17}/></span><div><span className="category-pill">{category}{category==='Assignment'&&assignment?` · ${assignment}`:''}</span><h3>{title||'Untitled resource'}</h3><p>{description||'No description added.'}</p></div></div><div className="review-detail-grid"><div><small>CATEGORY</small><b>{category}</b></div>{category==='Assignment'&&assignment&&<div><small>ASSIGNMENT TYPE</small><b>{assignment}</b></div>}{unit.trim()&&<div><small>UNIT / MODULE</small><b>{unit}</b></div>}{tags.trim()&&<div><small>TAGS</small><b>{tags}</b></div>}{externalUrl.trim()&&<div><small>CLOUD DRIVE</small><b style={{wordBreak:'break-all',fontSize:'10px'}}>{externalUrl}</b></div>}<div><small>FILES</small><b>{files.length} selected</b></div></div><div className="review-files">{files.map(f=><span key={fileKey(f)}><FileText size={13}/>{f.name}<small>{prettySize(f.size)}</small>{status==='uploading'&&<em className="file-progress-number">{progress[fileKey(f)]||0}%</em>}</span>)}{(existingResource.data?.resource_files||[]).map((f:any)=><span key={f.id}><FileText size={13}/>{f.original_name}<small>Already shared · {prettySize(f.size_bytes)}</small></span>)}</div></div>
        {status==='uploading'&&<div className="upload-progress-panel"><div><span>Overall upload progress</span><b>{overallProgress}%</b></div><span className="progress-track overall-track"><i style={{width:`${overallProgress}%`}}/></span><button type="button" className="subtle-action" onClick={()=>{cancelUpload.current=true;activeUpload.current?.abort();}}>Cancel pending uploads</button></div>}{errors.length>0&&<ErrorList errors={errors}/>}{uploadSummary&&<div className={`upload-result ${uploadSummary.failed.length?'warning':''}`}><CheckCircle2 size={17}/><div><b>{uploadSummary.done} file{uploadSummary.done===1?'':'s'} uploaded successfully</b>{uploadSummary.failed.length>0&&<small>{uploadSummary.failed.length} file(s) failed. Successful files are kept.</small>}</div></div>}
        {status==='success'?<div className="stage-actions"><span className="muted-hint">{editId?'Your changes are saved.':'Your resource is now in the library.'}</span><Link to="/library" className="button button-primary">View library <ArrowRight size={15}/></Link></div>:<div className="stage-actions"><button type="button" className="button button-secondary" onClick={()=>setStage(2)} disabled={status==='uploading'}><ArrowLeft size={15}/> Edit details</button><button type="submit" className="button button-primary" disabled={status==='uploading'||!backendConfigured||!user}>{status==='uploading'?<><RefreshCw className="spin" size={15}/> Saving…</>:status==='partial'?<><RefreshCw size={15}/> Retry failed files</>:editId?<><Check size={15}/> Save changes</>:<><Upload size={15}/> Publish resource</>}</button></div>}
      </section>}
      {errors.length>0&&stage!==3&&<ErrorList errors={errors}/>}
    </form><aside className="upload-aside"><div className="aside-note glass-panel"><span className="aside-icon"><ShieldCheck size={17}/></span><h3>Shared with care</h3><p>Only campus members with access can see and download resources. Your files stay in private storage.</p></div><div className="aside-note glass-panel"><span className="aside-icon"><Sparkles size={17}/></span><h3>Help others find it</h3><p>Use the description for course, branch, semester, subject, and any helpful context.</p></div><div className="aside-help"><CircleHelp size={15}/><span>Need to fix something later? You can edit your own resource from the library.</span></div></aside></div>
  </>;
}
function ErrorList({errors}:{errors:string[]}) { return <div className="error-list" role="alert">{errors.map((e,i)=><div key={i}><AlertCircle size={14}/>{e}</div>)}</div>; }

function Communities({user}:{user:Profile|null}) {
  const [query,setQuery]=useState('');const queryClient=useQueryClient();
  const people=useQuery({queryKey:['people',query],enabled:!!supabase&&!!user,queryFn:async()=>{let q=requireBackend().from('profiles').select('id,full_name,classflow_id,branch_id,semester_id').neq('id',user!.id).limit(40);if(query.trim())q=q.or(`full_name.ilike.%${query.trim()}%,classflow_id.ilike.%${query.trim()}%`);const {data,error}=await q;if(error)throw error;return data??[];}});
  const requests=useQuery({queryKey:['friend-requests',user?.id],enabled:!!supabase&&!!user,queryFn:async()=>{const db=requireBackend();const [{data:sent,error:se},{data:received,error:re}]=await Promise.all([db.from('friend_requests').select('id,sender_id,recipient_id,status').eq('sender_id',user!.id).in('status',['pending','accepted']),db.from('friend_requests').select('id,sender_id,recipient_id,status').eq('recipient_id',user!.id).in('status',['pending','accepted'])]);if(se)throw se;if(re)throw re;return [...(sent??[]),...(received??[])];}});
  async function connect(person:any){if(!supabase||!user)return;const db=requireBackend();const req=requests.data?.find((x:any)=>x.sender_id===person.id||x.recipient_id===person.id);try{if(!req){const {error}=await db.from('friend_requests').insert({sender_id:user.id,recipient_id:person.id});if(error)throw error;toast('Friend request sent.');}else if(req.status==='pending'&&req.sender_id===user.id){const {error}=await db.from('friend_requests').update({status:'cancelled'}).eq('id',req.id);if(error)throw error;toast('Request cancelled.');}else if(req.status==='pending'&&req.recipient_id===user.id){const {error}=await db.from('friend_requests').update({status:'accepted'}).eq('id',req.id);if(error)throw error;const [one,two]=[user.id,person.id].sort();const {error:friendError}=await db.from('friendships').insert({user_one:one,user_two:two});if(friendError)throw friendError;toast('You’re connected.');}else if(req.status==='accepted'){const {error}=await db.from('friend_requests').update({status:'cancelled'}).eq('id',req.id);if(error)throw error;const [one,two]=[user.id,person.id].sort();const {error:deleteError}=await db.from('friendships').delete().eq('user_one',one).eq('user_two',two);if(deleteError)throw deleteError;toast('Connection removed.');}}catch(err){toast(err instanceof Error?err.message:'Could not update this connection.');}await Promise.all([requests.refetch(),queryClient.invalidateQueries({queryKey:['people']})]);}
  function connectionLabel(person:any){const req=requests.data?.find((x:any)=>x.sender_id===person.id||x.recipient_id===person.id);if(!req)return <>Connect <Plus size={14}/></>;if(req.status==='accepted')return <>Connected <Check size={14}/></>;if(req.sender_id===user?.id)return <>Request sent <X size={14}/></>;return <>Accept request <Check size={14}/></>;}
  return <><PageHeading eyebrow="CAMPUS NETWORK" title="People make learning." description="Find classmates and build your campus circle, one connection at a time."/><BackendGate user={user} feature="Student directory and friend connections"/>{backendConfigured&&user&&<><div className="library-search-row"><div className="library-search"><Search size={17}/><input placeholder="Find by name or ClassFlow ID..." value={query} onChange={e=>setQuery(e.target.value)}/></div><Link to="/messages?createGroup=1" className="filter-button"><Users size={16}/> Group chat</Link></div>{people.data?.length?<div className="people-grid">{people.data.map((p:any)=><div className="person-card glass-panel" key={p.id}><Avatar name={p.full_name}/><div><b>{p.full_name}</b><small>{p.classflow_id}</small></div><button className="button button-secondary compact" onClick={()=>void connect(p)}>{connectionLabel(p)}</button></div>)}</div>:<DataState title={people.isLoading?'Finding your campus…':'A campus circle starts here'} text={people.isLoading?'':'No classmates to show yet. Once your campus members join, you can find and connect with each other here.'} icon={<Users size={22}/>}/>}</>}</>;
}

function Messages({user}:{user:Profile|null}) {
  const queryClient=useQueryClient();const location=useLocation();
  const [activeId,setActiveId]=useState('');
  const [draft,setDraft]=useState('');
  const [friendFilter,setFriendFilter]=useState('');
  const [groupOpen,setGroupOpen]=useState(false);
  useEffect(()=>{if(new URLSearchParams(location.search).get('createGroup')==='1')setGroupOpen(true);},[location.search]);
  const [groupTitle,setGroupTitle]=useState('');
  const [groupDescription,setGroupDescription]=useState('');
  const [selectedFriends,setSelectedFriends]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const messagesEnd=useRef<HTMLDivElement|null>(null);
  const conversations=useQuery({queryKey:['conversations',user?.id],enabled:!!supabase&&!!user,queryFn:async()=>{
    const db=requireBackend();
    const {data,error}=await db.from('conversation_members').select('conversation_id,role,last_read_at,conversations!inner(id,kind,title,updated_at)').eq('user_id',user!.id);
    if(error)throw error;
    const rows=(data??[]).map((row:any)=>({...(row.conversations||{}),membership_role:row.role})).filter((row:any)=>row.id);
    if(!rows.length)return [];
    const ids=rows.map((row:any)=>row.id);
    const {data:members,error:memberError}=await db.from('conversation_members').select('conversation_id,user_id').in('conversation_id',ids).neq('user_id',user!.id);
    if(memberError)throw memberError;
    const otherIds=[...new Set((members??[]).map((row:any)=>row.user_id))];
    const {data:profiles,error:profileError}=otherIds.length?await db.from('profiles').select('id,full_name').in('id',otherIds):{data:[],error:null};
    if(profileError)throw profileError;
    const labels=new Map((profiles??[]).map((p:any)=>[p.id,p.full_name]));
    return rows.map((row:any)=>({...row,display_title:row.kind==='group'?row.title:labels.get((members??[]).find((m:any)=>m.conversation_id===row.id)?.user_id)||'Direct message'})).sort((a:any,b:any)=>new Date(b.updated_at||0).getTime()-new Date(a.updated_at||0).getTime());
  }});
  const friends=useQuery({queryKey:['message-friends',user?.id],enabled:!!supabase&&!!user,queryFn:async()=>{
    const db=requireBackend();
    const {data:edges,error}=await db.from('friendships').select('user_one,user_two').or(`user_one.eq.${user!.id},user_two.eq.${user!.id}`);
    if(error)throw error;
    const ids=[...new Set((edges??[]).map((row:any)=>row.user_one===user!.id?row.user_two:row.user_one))];
    if(!ids.length)return [];
    const {data,error:profileError}=await db.from('profiles').select('id,full_name,classflow_id').in('id',ids).order('full_name');
    if(profileError)throw profileError;
    return data??[];
  }});
  const active=conversations.data?.find((item:any)=>item.id===activeId);
  const chatMessages=useQuery({queryKey:['conversation-messages',activeId],enabled:!!supabase&&!!user&&!!activeId,queryFn:async()=>{
    const {data,error}=await requireBackend().from('messages').select('id,body,sender_id,created_at,edited_at,deleted_at,profiles:profiles!messages_sender_id_fkey(full_name)').eq('conversation_id',activeId).is('deleted_at',null).order('created_at',{ascending:true}).limit(120);
    if(error)throw error;
    return data??[];
  }});
  useEffect(()=>{if(!activeId&&conversations.data?.length)setActiveId(conversations.data[0].id);},[activeId,conversations.data]);
  useEffect(()=>{
    if(!supabase||!activeId)return;
    const channel=supabase.channel(`classflow-chat-${activeId}`).on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:`conversation_id=eq.${activeId}`},()=>{void queryClient.invalidateQueries({queryKey:['conversation-messages',activeId]});void queryClient.invalidateQueries({queryKey:['conversations',user?.id]});}).subscribe();
    return()=>{void supabase?.removeChannel(channel);};
  },[activeId,user?.id,queryClient]);
  useEffect(()=>{if(!activeId||!user||!chatMessages.data?.length)return;void requireBackend().from('conversation_members').update({last_read_at:new Date().toISOString()}).eq('conversation_id',activeId).eq('user_id',user.id);},[activeId,user?.id,chatMessages.data?.length]);
  useEffect(()=>{messagesEnd.current?.scrollIntoView?.({behavior:'smooth',block:'end'});},[chatMessages.data]);
  async function openDirect(friendId:string){
    if(!user)return;
    setBusy(true);setError('');
    try{const {data,error}=await requireBackend().rpc('create_direct_conversation',{target_user:friendId});if(error)throw error;const id=String(data);setActiveId(id);await Promise.all([conversations.refetch(),queryClient.invalidateQueries({queryKey:['conversations',user.id]})]);}
    catch(e){setError(e instanceof Error?e.message:'Could not open this conversation.');}
    finally{setBusy(false);}
  }
  async function createGroup(e:FormEvent){
    e.preventDefault();if(!user)return;setBusy(true);setError('');
    try{const {data,error}=await requireBackend().rpc('create_group_conversation',{p_title:groupTitle.trim(),p_description:groupDescription.trim()||null,p_members:selectedFriends});if(error)throw error;setActiveId(String(data));setGroupOpen(false);setGroupTitle('');setGroupDescription('');setSelectedFriends([]);await queryClient.invalidateQueries({queryKey:['conversations',user.id]});}
    catch(e){setError(e instanceof Error?e.message:'Could not create this group.');}
    finally{setBusy(false);}
  }
  async function sendMessage(e:FormEvent){
    e.preventDefault();const body=draft.trim();if(!user||!activeId||!body||body.length>10000)return;setBusy(true);setError('');
    try{const {error}=await requireBackend().from('messages').insert({conversation_id:activeId,sender_id:user.id,body});if(error)throw error;setDraft('');await Promise.all([queryClient.invalidateQueries({queryKey:['conversation-messages',activeId]}),queryClient.invalidateQueries({queryKey:['conversations',user.id]})]);}
    catch(e){setError(e instanceof Error?e.message:'Message could not be sent.');}
    finally{setBusy(false);}
  }
  const filteredFriends=(friends.data??[]).filter((p:any)=>!friendFilter||`${p.full_name} ${p.classflow_id}`.toLowerCase().includes(friendFilter.toLowerCase()));
  return <><PageHeading eyebrow="CAMPUS CONVERSATIONS" title="Messages" description="Private, real-time conversations with students you’ve connected with." action={<button className="button button-primary compact" onClick={()=>setGroupOpen(v=>!v)}><Plus size={15}/>{groupOpen?'Close group form':'New group'}</button>}/><BackendGate user={user} feature="Direct and group messaging"/>{backendConfigured&&user&&<>
    {groupOpen&&<form className="group-create-panel glass-panel" onSubmit={createGroup}><div><span className="eyebrow">START A STUDY CIRCLE</span><h2>Create a group</h2><p>Only accepted connections can be added. Membership is enforced in the database.</p></div><div className="group-create-fields"><label className="field"><span>Group name</span><input required maxLength={80} value={groupTitle} onChange={e=>setGroupTitle(e.target.value)} placeholder="e.g. Data Structures study group"/></label><label className="field"><span>About <small>(optional)</small></span><input maxLength={500} value={groupDescription} onChange={e=>setGroupDescription(e.target.value)} placeholder="What are you studying together?"/></label></div><div className="group-friend-picker">{(friends.data??[]).map((friend:any)=><label key={friend.id}><input type="checkbox" checked={selectedFriends.includes(friend.id)} onChange={e=>setSelectedFriends(old=>e.target.checked?[...old,friend.id]:old.filter(id=>id!==friend.id))}/><span>{friend.full_name}</span></label>)}{!friends.data?.length&&<small>Connect with classmates first to invite them.</small>}</div><button className="button button-primary compact" disabled={busy}>{busy?'Creating…':'Create group'}</button></form>}
    {error&&<div className="copilot-error"><AlertCircle size={15}/>{error}</div>}
    <div className="messenger-layout glass-panel"><aside className="messenger-sidebar"><div className="messenger-sidebar-head"><div><span className="eyebrow">YOUR INBOX</span><b>Conversations</b></div><span className="messenger-count">{conversations.data?.length||0}</span></div><div className="messenger-friend-search"><Search size={14}/><input value={friendFilter} onChange={e=>setFriendFilter(e.target.value)} placeholder="Find a connection…" aria-label="Find a connection"/></div><div className="messenger-section-label">CHATS</div><div className="messenger-chat-list">{conversations.data?.map((chat:any)=><button key={chat.id} className={`messenger-chat-row ${activeId===chat.id?'active':''}`} onClick={()=>setActiveId(chat.id)}><span className="avatar avatar-small">{String(chat.display_title).split(' ').slice(0,2).map((v:string)=>v[0]).join('').toUpperCase()}</span><span><b>{chat.display_title}</b><small>{chat.kind==='group'?'Study group':'Direct message'}</small></span><MessageCircle size={14}/></button>)}{conversations.isLoading&&<small className="messenger-empty-label">Loading conversations…</small>}{!conversations.isLoading&&!conversations.data?.length&&<small className="messenger-empty-label">No conversations yet.</small>}</div><div className="messenger-section-label">CONNECTIONS</div><div className="messenger-friend-list">{filteredFriends.map((friend:any)=><button key={friend.id} onClick={()=>void openDirect(friend.id)} disabled={busy}><span className="avatar avatar-small">{friend.full_name.split(' ').slice(0,2).map((v:string)=>v[0]).join('').toUpperCase()}</span><span><b>{friend.full_name}</b><small>{friend.classflow_id}</small></span><Plus size={14}/></button>)}{!friends.isLoading&&!filteredFriends.length&&<small className="messenger-empty-label">Accepted connections appear here.</small>}</div></aside><section className="messenger-thread">{active?<><header className="thread-header"><span className="avatar">{String(active.display_title).split(' ').slice(0,2).map((v:string)=>v[0]).join('').toUpperCase()}</span><div><b>{active.display_title}</b><small>{active.kind==='group'?'Group conversation':'Private conversation'}</small></div><span className="thread-live"><i/> Secured by your campus account</span></header><div className="thread-messages">{chatMessages.isLoading&&<DataState title="Loading conversation…" icon={<MessageCircle size={19}/>}/>}{!chatMessages.isLoading&&!chatMessages.data?.length&&<DataState title="A fresh start" text="Send the first message to get the conversation going." icon={<MessageCircle size={19}/>}/>}{chatMessages.data?.map((message:any)=><div key={message.id} className={`chat-message ${message.sender_id===user.id?'mine':''}`}><span className="chat-message-author">{message.sender_id===user.id?'You':message.profiles?.full_name||'Classmate'}</span><p>{message.body}</p><small>{new Date(message.created_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</small></div>)}<div ref={messagesEnd}/></div><form className="thread-compose" onSubmit={sendMessage}><input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={10000} placeholder="Write a message…" aria-label="Write a message"/><button className="button button-primary compact" disabled={busy||!draft.trim()} aria-label="Send message"><Send size={15}/></button></form></>:<div className="thread-welcome"><span className="message-illustration"><span><MessageCircle size={27}/></span><i/><i/><i/></span><h2>Your campus conversations</h2><p>Choose a connection or open a chat. Messages are stored in Supabase and private to conversation members.</p></div>}</section></div>
  </>}</>;
}
function ProfilePostTile({resource,user,onSelect}:{resource:Resource;user:Profile;onSelect:(resource:Resource)=>void}) {
  const [coverUrl,setCoverUrl]=useState<string|null>(null);const [imageFailed,setImageFailed]=useState(false);
  const imageFile=resource.resource_files?.find((file:any)=>file.mime_type?.toLowerCase().startsWith('image/')||/\.(png|jpe?g|gif|webp)$/i.test(file.original_name||''));
  useEffect(()=>{let cancelled=false;if(!imageFile||!supabase){setCoverUrl(null);return;}void requireBackend().storage.from('classflow-resources').createSignedUrl(imageFile.storage_path,600).then(({data,error})=>{if(!cancelled){setCoverUrl(error?null:data?.signedUrl||null);setImageFailed(Boolean(error));}}).catch(()=>{if(!cancelled)setImageFailed(true);});return()=>{cancelled=true;};},[imageFile?.storage_path,user.id]);
  return <button type="button" className="profile-post-tile" onClick={()=>onSelect(resource)} aria-label={`Open ${resource.title}`}>
    {coverUrl&&!imageFailed?<img src={coverUrl} alt={resource.title} loading="lazy" onError={()=>setImageFailed(true)}/>:<span className="profile-post-placeholder"><span>{imageFile?<FileImage size={24}/>:<FileText size={24}/>}</span><b>{resource.category}</b><small>{resource.resource_files?.[0]?.original_name||'Class resource'}</small></span>}
    <span className="profile-post-overlay"><b>{resource.title}</b><small>{resource.resource_files?.length??0} {(resource.resource_files?.length??0)===1?'file':'files'}</small></span>
    {(resource.resource_files?.length||0)>1&&<span className="profile-post-file-count">+{resource.resource_files!.length-1}</span>}
  </button>;
}
function ProfilePage({user,onUpdate}:{user:Profile|null;onUpdate:(id:string)=>Promise<void>}) {
  const [editing,setEditing]=useState(false);const [fullName,setFullName]=useState(user?.full_name||'');const [bio,setBio]=useState(user?.bio||'');const [saving,setSaving]=useState(false);const [activePost,setActivePost]=useState<Resource|null>(null);
  useEffect(()=>{setFullName(user?.full_name||'');setBio(user?.bio||'');},[user?.id,user?.full_name,user?.bio]);
  const posts=useQuery({queryKey:['profile-resources',user?.id],enabled:!!supabase&&!!user,queryFn:async()=>{const {data,error}=await requireBackend().from('resources').select('id,title,description,category,assignment_type,branch_id,semester_id,subject_id,unit_module,tags,page_count,created_at,updated_at,profiles:profiles!resources_uploaded_by_fkey(full_name,classflow_id),resource_files(id,original_name,mime_type,size_bytes,storage_path)').eq('uploaded_by',user!.id).eq('is_published',true).is('deleted_at',null).is('resource_files.deleted_at',null).order('created_at',{ascending:false}).limit(100);if(error)throw error;return (data??[]) as unknown as Resource[];}});
  async function saveProfile(e:FormEvent){e.preventDefault();if(!user||!supabase)return;const cleanName=fullName.trim();const cleanBio=bio.trim();if(cleanName.length<2||cleanName.length>80){toast('Name must be between 2 and 80 characters.');return;}setSaving(true);try{const {error}=await requireBackend().from('profiles').update({full_name:cleanName,bio:cleanBio||null}).eq('id',user.id);if(error)throw error;await onUpdate(user.id);setEditing(false);toast('Profile updated.');}catch(err){toast(err instanceof Error?err.message:'Profile could not be updated.');}finally{setSaving(false);}}
  return <><PageHeading eyebrow="YOUR CAMPUS IDENTITY" title="Your profile" description="Your identity and the class resources you’ve shared." action={<Link to="/upload" className="button button-primary compact"><Upload size={14}/> Share a resource</Link>}/><BackendGate user={user} feature="Your profile and campus identity"/>{user&&<div className="profile-page">
    <section className="profile-view glass-panel"><Avatar name={user.full_name}/><div className="profile-identity"><span className="eyebrow">{user.role==='admin'?'CAMPUS ADMIN':user.role==='subadmin'?'CAMPUS SUBADMIN':'CLASSFLOW MEMBER'}</span><h2>{user.full_name}</h2><p>@{user.username}</p>{bio.trim()&&<p className="profile-bio">{bio}</p>}<small>ClassFlow ID · {user.classflow_id}</small></div><div className="profile-header-actions">{(user.role==='admin'||user.role==='subadmin')&&<Link to="/admin" className="button button-primary compact"><ShieldCheck size={14}/> Admin studio</Link>}<button type="button" className="button button-secondary compact" onClick={()=>setEditing(v=>!v)}><Pencil size={14}/>{editing?'Close':'Edit profile'}</button><div className="profile-stat"><b>{posts.data?.length??0}</b><small>posts</small></div></div>
    </section>
    {editing&&<form className="profile-edit-card glass-panel" onSubmit={saveProfile}><div className="profile-edit-heading"><div><span className="eyebrow">PROFILE DETAILS</span><h2>Edit your profile</h2></div><button type="button" className="icon-button tiny" onClick={()=>setEditing(false)} aria-label="Close profile editor"><X size={15}/></button></div><label className="field"><span>Display name</span><input required minLength={2} maxLength={80} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your name"/></label><label className="field"><span>Bio <small>(optional)</small></span><textarea maxLength={180} rows={3} value={bio} onChange={e=>setBio(e.target.value)} placeholder="A little about you or what you’re studying…"/><small className="field-help">{bio.length}/180</small></label><div className="profile-edit-footer"><span className="muted-hint">Username and ClassFlow ID can’t be changed here.</span><button className="button button-primary compact" disabled={saving}>{saving?<><RefreshCw className="spin" size={14}/> Saving…</>:<><Check size={14}/> Save profile</>}</button></div></form>}
    <section className="profile-posts"><div className="profile-posts-heading"><div><span className="eyebrow">YOUR LIBRARY</span><h2>Your posts</h2></div><span>{posts.data?.length??0} shared</span></div>{posts.isLoading?<div className="profile-post-grid">{[1,2,3].map(i=><div className="profile-post-skeleton" key={i}/>)}</div>:posts.isError?<div className="profile-post-empty"><b>Couldn’t load your posts.</b><button className="text-button" onClick={()=>void posts.refetch()}>Try again <RefreshCw size={13}/></button></div>:posts.data?.length?<div className="profile-post-grid">{posts.data.map(resource=><ProfilePostTile key={resource.id} resource={resource} user={user} onSelect={setActivePost}/>)}</div>:<div className="profile-post-empty"><span className="soft-icon"><BookOpen size={18}/></span><div><b>Your shared resources will appear here</b><small>Upload notes, assignments or class material to start your profile library.</small></div><Link to="/upload" className="button button-secondary compact"><Plus size={14}/> Share your first resource</Link></div>}</section>
  </div>}{activePost&&user&&<div className="profile-post-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setActivePost(null);}}><div className="profile-post-dialog" role="dialog" aria-modal="true" aria-label={activePost.title}><button className="profile-post-close" onClick={()=>setActivePost(null)} aria-label="Close post"><X size={18}/></button><ResourceCard resource={activePost} user={user}/></div></div>}</>;
}
function AdminPage({user}:{user:Profile|null}) {
  const queryClient=useQueryClient();const [tab,setTab]=useState('overview');const [target,setTarget]=useState('');const [selectedRole,setSelectedRole]=useState('student');const [selectedPermissions,setSelectedPermissions]=useState<string[]>([]);const [branchName,setBranchName]=useState('');const [branchCode,setBranchCode]=useState('');const [semesterName,setSemesterName]=useState('');const [semesterNumber,setSemesterNumber]=useState('');const [subjectName,setSubjectName]=useState('');const [subjectCode,setSubjectCode]=useState('');const [subjectBranch,setSubjectBranch]=useState('');const [subjectSemester,setSubjectSemester]=useState('');const [noticeTitle,setNoticeTitle]=useState('');const [noticeBody,setNoticeBody]=useState('');const [noticePriority,setNoticePriority]=useState('normal');const [noticeBusy,setNoticeBusy]=useState(false);
  const isAdmin=user?.role==='admin';const permissionList=['resources.manage','resources.edit','resources.delete','notices.manage','academic.manage','reports.manage','groups.manage','messages.moderate','calls.manage'];
  const dutyCategories = [
    { key: 'resources', name: 'Notes & Files Moderation', desc: 'Approve, edit and manage uploaded study notes & files', perms: ['resources.manage','resources.edit','resources.delete'], icon: <BookOpen size={15}/> },
    { key: 'notices', name: 'Campus Notices & Broadcasts', desc: 'Publish and manage official college alerts & bulletins', perms: ['notices.manage'], icon: <Megaphone size={15}/> },
    { key: 'academic', name: 'Academic Catalogue & Syllabus', desc: 'Add & organize branches, semesters and subjects', perms: ['academic.manage'], icon: <GraduationCap size={15}/> },
    { key: 'community', name: 'Community Discussions', desc: 'Oversee student messages and study groups', perms: ['messages.moderate','groups.manage'], icon: <Users size={15}/> },
    { key: 'reports', name: 'Safety & Flagged Reports', desc: 'Review reported content and safety issues', perms: ['reports.manage'], icon: <ShieldCheck size={15}/> },
    { key: 'calls', name: 'Study Rooms & Calls', desc: 'Manage LiveKit audio and video rooms', perms: ['calls.manage'], icon: <Activity size={15}/> },
  ];
  const toggleDutyCategory = (perms: string[]) => {
    const allSelected = perms.every(p => selectedPermissions.includes(p));
    if (allSelected) {
      setSelectedPermissions(old => old.filter(p => !perms.includes(p)));
    } else {
      setSelectedPermissions(old => Array.from(new Set([...old, ...perms])));
    }
  };
  const applyDutyPreset = (preset: 'academic' | 'comms' | 'all' | 'clear') => {
    if (preset === 'clear') setSelectedPermissions([]);
    else if (preset === 'academic') setSelectedPermissions(['resources.manage','resources.edit','resources.delete','academic.manage']);
    else if (preset === 'comms') setSelectedPermissions(['notices.manage','messages.moderate','groups.manage']);
    else if (preset === 'all') setSelectedPermissions([...permissionList]);
  };
  const people=useQuery({queryKey:['admin-people'],enabled:!!supabase&&isAdmin,queryFn:async()=>{const db=requireBackend();const [{data:p,error:pe},{data:r,error:re}]=await Promise.all([db.from('profiles').select('id,full_name,username,classflow_id,created_at').is('deleted_at',null).order('full_name').limit(500),db.from('user_roles').select('user_id,role')]);if(pe)throw pe;if(re)throw re;return (p??[]).map((x:any)=>({...x,role:(r??[]).find((v:any)=>v.user_id===x.id)?.role||'student'}));}});
  const targetPermissionRows=useQuery({queryKey:['admin-user-permissions',target],enabled:!!supabase&&isAdmin&&!!target,queryFn:async()=>{const {data,error}=await requireBackend().from('user_permissions').select('permission').eq('user_id',target);if(error)throw error;return (data??[]).map((v:any)=>v.permission as string);}});
  useEffect(()=>{if(targetPermissionRows.data)setSelectedPermissions(targetPermissionRows.data);},[targetPermissionRows.data]);
  useEffect(()=>{const member=people.data?.find((p:any)=>p.id===target);if(member)setSelectedRole(member.role||'student');},[target,people.data]);
  const branches=useQuery({queryKey:['admin-branches'],enabled:!!supabase&&!!user&&(isAdmin||user.permissions?.includes('academic.manage')),queryFn:async()=>{const {data,error}=await requireBackend().from('branches').select('id,name,code').order('name');if(error)throw error;return data??[];}});
  const semesters=useQuery({queryKey:['admin-semesters'],enabled:!!supabase&&!!user&&(isAdmin||user.permissions?.includes('academic.manage')),queryFn:async()=>{const {data,error}=await requireBackend().from('semesters').select('id,name,number').order('number');if(error)throw error;return data??[];}});
  const subjects=useQuery({queryKey:['admin-subjects'],enabled:!!supabase&&!!user&&(isAdmin||user.permissions?.includes('academic.manage')),queryFn:async()=>{const {data,error}=await requireBackend().from('subjects').select('id,name,code,branches(name),semesters(name)').order('name').limit(200);if(error)throw error;return data??[];}});
  const adminResources=useQuery({queryKey:['admin-resources'],enabled:!!supabase&&!!user&&(isAdmin||user.permissions?.some(p=>['resources.manage','resources.edit'].includes(p))),queryFn:async()=>{const {data,error}=await requireBackend().from('resources').select('id,title,description,category,assignment_type,branch_id,semester_id,subject_id,unit_module,tags,page_count,created_at,updated_at,profiles:profiles!resources_uploaded_by_fkey(full_name,classflow_id),resource_files(id,original_name,mime_type,size_bytes,storage_path)').eq('is_published',true).is('deleted_at',null).is('resource_files.deleted_at',null).order('created_at',{ascending:false}).limit(12);if(error)throw error;return data as unknown as Resource[];}});
  const notices=useQuery({queryKey:['admin-notices'],enabled:!!supabase&&!!user&&(isAdmin||user.permissions?.includes('notices.manage')),queryFn:async()=>{const {data,error}=await requireBackend().from('notices').select('id,title,body,priority,is_published,created_at').order('created_at',{ascending:false}).limit(100);if(error)throw error;return data??[];}});
  async function savePermissions(e:FormEvent){e.preventDefault();if(!target)return;const {error}=await requireBackend().rpc('set_user_role',{target_user:target,target_role:selectedRole,permissions:selectedRole==='subadmin'?selectedPermissions:[]});if(error){toast(error.message);return;}await Promise.all([people.refetch(),targetPermissionRows.refetch()]);toast(selectedRole==='subadmin'?'Subadmin role and permissions saved.':`Member role set to ${selectedRole}.`);}
  async function removeSubadmin(id:string){if(!window.confirm('Remove this user’s Subadmin role and permissions?'))return;const {error}=await requireBackend().rpc('set_user_role',{target_user:id,target_role:'student',permissions:[]});if(error){toast(error.message);return;}await Promise.all([people.refetch(),queryClient.invalidateQueries({queryKey:['admin-user-permissions',id]})]);toast('Subadmin access removed.');}
  async function quickMakeSubadmin(id:string){
    const defaultPerms = ['resources.manage','resources.edit','notices.manage','academic.manage'];
    const {error}=await requireBackend().rpc('set_user_role',{target_user:id,target_role:'subadmin',permissions:defaultPerms});
    if(error){toast(error.message);return;}
    await Promise.all([people.refetch(),queryClient.invalidateQueries({queryKey:['admin-user-permissions',id]})]);
    toast('Promoted to Subadmin with core duties! 🛡️');
  }
  async function addBranch(e:FormEvent){e.preventDefault();const {error}=await requireBackend().from('branches').insert({name:branchName.trim(),code:branchCode.trim()||null});if(error){toast(error.message);return;}setBranchName('');setBranchCode('');await Promise.all([branches.refetch(),filterInvalidation()]);toast('Branch added.');}
  async function filterInvalidation(){await queryClient.invalidateQueries({queryKey:['branches']});}
  async function addSemester(e:FormEvent){e.preventDefault();const {error}=await requireBackend().from('semesters').insert({name:semesterName.trim(),number:Number(semesterNumber)});if(error){toast(error.message);return;}setSemesterName('');setSemesterNumber('');await semesters.refetch();await queryClient.invalidateQueries({queryKey:['semesters']});toast('Semester added.');}
  async function addSubject(e:FormEvent){e.preventDefault();const {error}=await requireBackend().from('subjects').insert({name:subjectName.trim(),code:subjectCode.trim()||null,branch_id:subjectBranch,semester_id:subjectSemester,created_by:user?.id});if(error){toast(error.message);return;}setSubjectName('');setSubjectCode('');await subjects.refetch();await queryClient.invalidateQueries({queryKey:['subjects']});toast('Subject added.');}
  async function addNotice(e:FormEvent){e.preventDefault();if(!user)return;setNoticeBusy(true);const {error}=await requireBackend().from('notices').insert({title:noticeTitle.trim(),body:noticeBody.trim(),priority:noticePriority,author_id:user.id,is_published:true,publish_at:new Date().toISOString()});setNoticeBusy(false);if(error){toast(error.message);return;}setNoticeTitle('');setNoticeBody('');await Promise.all([notices.refetch(),queryClient.invalidateQueries({queryKey:['notices']})]);toast('Campus notice published.');}
  if(!backendConfigured||!user)return <><PageHeading eyebrow="CAMPUS MANAGEMENT" title="Admin studio" description="A thoughtful workspace for maintaining your campus community."/><BackendGate user={user} feature="Admin tools"/></>;
  if(!isAdmin&&user.role!=='subadmin')return <><PageHeading eyebrow="CAMPUS MANAGEMENT" title="Admin studio" description="A thoughtful workspace for maintaining your campus community."/><DataState title="You don’t have admin access" text="This area is limited to campus administrators and assigned moderators." icon={<ShieldCheck size={22}/>}/></>;
  const canAcademic=isAdmin||user.permissions?.includes('academic.manage');const canResources=isAdmin||user.permissions?.some(p=>['resources.manage','resources.edit'].includes(p));const canNotices=isAdmin||user.permissions?.includes('notices.manage');
  return <><PageHeading eyebrow="CAMPUS MANAGEMENT" title="Admin studio" description="A thoughtful workspace for maintaining your campus community." action={<span className="admin-role-pill"><ShieldCheck size={14}/>{isAdmin?'Administrator':'Subadmin'}</span>}/>
    <div className="admin-tabs">{[['overview','Overview'],...(isAdmin?[['people','People & roles']]:[]),...(canAcademic?[['academic','Academic setup']]:[]),...(canNotices?[['notices','Notices']]:[]),...(canResources?[['resources','Resources']]:[])].map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</div>
    {tab==='overview'&&<><CampusUsersDonutChart people={people.data ?? []} onSelectRoleFilter={(r)=>{setTab('people');setSelectedRole(r);}} /><div className="admin-overview-grid"><button className="admin-overview-card glass-panel" onClick={()=>setTab(isAdmin?'people':'resources')}><span><Users size={18}/></span><b>People & Subadmins</b><small>{isAdmin?'Appoint Subadmins & manage duties.':'Your assigned moderator scope.'}</small><ArrowRight size={14}/></button><button className="admin-overview-card glass-panel" onClick={()=>setTab(canAcademic?'academic':'overview')}><span><GraduationCap size={18}/></span><b>Academic catalogue</b><small>{canAcademic?'Manage branches, semesters and subjects.':'Academic setup access is not assigned.'}</small><ArrowRight size={14}/></button><button className="admin-overview-card glass-panel" onClick={()=>setTab(canResources?'resources':'overview')}><span><BookOpen size={18}/></span><b>Resource moderation</b><small>{canResources?'Review recent campus resources.':'Resource moderation access is not assigned.'}</small><ArrowRight size={14}/></button><Link to="/settings" className="admin-overview-card glass-panel"><span><Settings size={18}/></span><b>Integrations</b><small>Check setup status and server-side configuration guidance.</small><ArrowRight size={14}/></Link></div><div className="inline-notice"><ShieldCheck size={17}/><span><b>Privileged actions are protected server-side.</b> Role and permission checks are enforced by Postgres RLS and the security-definer admin RPC.</span></div></>}
    {tab==='people'&&isAdmin&&<div className="admin-section-grid"><section className="admin-panel glass-panel"><div className="admin-panel-heading"><div><span className="eyebrow">SUBADMIN & ROLES STUDIO</span><h2>Appoint Subadmin & Assign Duties</h2><p>Promote a campus member to Subadmin and select their specific work areas.</p></div></div><form onSubmit={savePermissions} className="admin-form"><label className="field"><span>Campus member</span><select value={target} onChange={e=>setTarget(e.target.value)} required><option value="">Choose a member</option>{people.data?.filter((p:any)=>p.id!==user?.id).map((p:any)=><option key={p.id} value={p.id}>{p.full_name} · @{p.username} · {p.classflow_id} [{p.role?.toUpperCase()||'STUDENT'}]</option>)}</select></label><label className="field"><span>Role to assign</span><select value={selectedRole} onChange={e=>setSelectedRole(e.target.value)}><option value="student">Student (Standard Access)</option><option value="subadmin">Subadmin (Campus Moderator)</option><option value="admin">Administrator (Full Access)</option></select></label>{selectedRole==='subadmin'&&<div style={{marginTop:'12px'}}><span className="field-label" style={{fontSize:'12px',fontWeight:600,display:'block',marginBottom:'6px'}}>Assigned Subadmin Duties & Work Scope</span><div className="duty-preset-buttons"><button type="button" className="duty-preset-btn" onClick={()=>applyDutyPreset('academic')}>📚 Content Moderator</button><button type="button" className="duty-preset-btn" onClick={()=>applyDutyPreset('comms')}>📢 Broadcasts Lead</button><button type="button" className="duty-preset-btn" onClick={()=>applyDutyPreset('all')}>🛡️ Full Scope</button><button type="button" className="duty-preset-btn" onClick={()=>applyDutyPreset('clear')} style={{opacity:0.7}}>Clear</button></div><div className="subadmin-work-grid">{dutyCategories.map(cat=>{const checked=cat.perms.every(p=>selectedPermissions.includes(p));return (<div key={cat.key} className={`duty-checkbox-card ${checked?'checked':''}`} onClick={()=>toggleDutyCategory(cat.perms)}><input type="checkbox" checked={checked} onChange={()=>{}} style={{marginTop:'3px'}}/><div className="duty-copy"><div style={{display:'flex',alignItems:'center',gap:'6px'}}>{cat.icon}<b>{cat.name}</b></div><small>{cat.desc}</small></div></div>);})}</div></div>}<button className="button button-primary compact" disabled={!target||targetPermissionRows.isFetching} style={{marginTop:'10px'}}>Save Subadmin Duties <Check size={14}/></button></form></section><section className="admin-panel glass-panel"><div className="admin-panel-heading"><div><span className="eyebrow">CAMPUS DIRECTORY & SUBADMINS</span><h2>Active Members ({people.data?.length??0})</h2><p>List of campus accounts and appointed moderators.</p></div></div><div className="admin-people-list">{people.data?.map((p:any)=>{
  const isSub=p.role==='subadmin';
  const isAdm=p.role==='admin';
  return (<div className="admin-person-row" key={p.id} style={{padding:'10px 12px'}}>
    <Avatar name={p.full_name} small/>
    <div style={{flex:1,minWidth:0}}>
      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
        <b>{p.full_name}</b>
        <span className={`status-pill ${isAdm?'urgent':isSub?'connected':'normal'}`} style={{fontSize:'8px',padding:'2px 6px'}}>{p.role?.toUpperCase()||'STUDENT'}</span>
      </div>
      <small style={{color:'var(--taupe)'}}>@{p.username} · {p.classflow_id}</small>
    </div>
    {!isAdm&&p.id!==user?.id&&(
      <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
        {isSub?(
          <>
            <button type="button" className="text-button" onClick={()=>{setTarget(p.id);setSelectedRole('subadmin');}} style={{fontSize:'11px',gap:'3px'}} title="Edit assigned duties"><Pencil size={12}/> Duties</button>
            <button type="button" className="text-button" onClick={()=>void removeSubadmin(p.id)} style={{fontSize:'11px',color:'#ef4444',gap:'3px'}} title="Revoke Subadmin role"><X size={13}/> Revoke</button>
          </>
        ):(
          <button type="button" className="button button-secondary compact" onClick={()=>void quickMakeSubadmin(p.id)} style={{fontSize:'11px',padding:'4px 8px',gap:'4px'}} title="Promote to Subadmin">
            <UserPlus size={12}/> Make Subadmin
          </button>
        )}
      </div>
    )}
  </div>);
})}</div></section></div>}
    {tab==='academic'&&canAcademic&&<div className="admin-section-grid"><section className="admin-panel glass-panel"><div className="admin-panel-heading"><div><span className="eyebrow">ACADEMIC STRUCTURE</span><h2>Branches & semesters</h2><p>Manage the optional campus directory and search filters.</p></div></div><form className="admin-inline-form" onSubmit={addBranch}><label className="field"><span>Branch name</span><input value={branchName} onChange={e=>setBranchName(e.target.value)} placeholder="Computer Science" required/></label><label className="field"><span>Code</span><input value={branchCode} onChange={e=>setBranchCode(e.target.value)} placeholder="CSE"/></label><button className="button button-secondary compact"><Plus size={14}/> Add branch</button></form><div className="admin-chip-list">{branches.data?.map((b:any)=><span key={b.id}>{b.name}{b.code?` · ${b.code}`:''}</span>)}</div><form className="admin-inline-form" onSubmit={addSemester}><label className="field"><span>Semester name</span><input value={semesterName} onChange={e=>setSemesterName(e.target.value)} placeholder="Semester 1" required/></label><label className="field"><span>Number</span><input type="number" min="1" value={semesterNumber} onChange={e=>setSemesterNumber(e.target.value)} placeholder="1" required/></label><button className="button button-secondary compact"><Plus size={14}/> Add semester</button></form><div className="admin-chip-list">{semesters.data?.map((s:any)=><span key={s.id}>{s.name}</span>)}</div></section><section className="admin-panel glass-panel"><div className="admin-panel-heading"><div><span className="eyebrow">SUBJECT CATALOGUE</span><h2>Manage subjects</h2><p>Subjects are scoped to a branch and semester.</p></div></div><form className="admin-form" onSubmit={addSubject}><label className="field"><span>Subject name</span><input value={subjectName} onChange={e=>setSubjectName(e.target.value)} placeholder="Data Structures" required/></label><label className="field"><span>Subject code</span><input value={subjectCode} onChange={e=>setSubjectCode(e.target.value)} placeholder="CS301"/></label><div className="auth-two"><label className="field"><span>Branch</span><select value={subjectBranch} onChange={e=>setSubjectBranch(e.target.value)} required><option value="">Choose branch</option>{branches.data?.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label className="field"><span>Semester</span><select value={subjectSemester} onChange={e=>setSubjectSemester(e.target.value)} required><option value="">Choose semester</option>{semesters.data?.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div><button className="button button-primary compact"><Plus size={14}/> Add subject</button></form><div className="admin-subject-list">{subjects.data?.map((s:any)=><span key={s.id}>{s.name}<small>{s.branches?.name} · {s.semesters?.name}</small></span>)}</div></section></div>}
    {tab==='notices'&&canNotices&&<div className="admin-section-grid"><section className="admin-panel glass-panel"><div className="admin-panel-heading"><div><span className="eyebrow">CAMPUS BROADCAST</span><h2>Publish a notice</h2><p>Published notices appear on the student dashboard.</p></div></div><form className="admin-form" onSubmit={addNotice}><label className="field"><span>Title</span><input value={noticeTitle} onChange={e=>setNoticeTitle(e.target.value)} maxLength={180} required placeholder="Exam schedule update"/></label><label className="field"><span>Message</span><textarea value={noticeBody} onChange={e=>setNoticeBody(e.target.value)} rows={5} maxLength={4000} required placeholder="Write the details students need to know."/></label><label className="field"><span>Priority</span><select value={noticePriority} onChange={e=>setNoticePriority(e.target.value)}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label><button className="button button-primary compact" disabled={noticeBusy}>{noticeBusy?<RefreshCw className="spin" size={14}/>:<Megaphone size={14}/>} Publish notice</button></form></section><section className="admin-panel glass-panel"><div className="admin-panel-heading"><div><span className="eyebrow">RECENT POSTS</span><h2>Notices</h2><p>Latest campus announcements.</p></div></div><div className="admin-people-list">{notices.data?.map((n:any)=><div className="admin-person-row" key={n.id}><span className="notice-symbol"><Megaphone size={14}/></span><span><b>{n.title}</b><small>{relativeTime(n.created_at)}</small></span><em>{n.priority}</em></div>)}</div></section></div>}
    {tab==='resources'&&canResources&&<><div className="admin-panel-heading admin-resource-heading"><div><span className="eyebrow">MODERATION</span><h2>Recent resources</h2><p>Manage resource records under your assigned permissions.</p></div><Link to="/library" className="text-button">Open library <ArrowRight size={14}/></Link></div>{adminResources.data?.length?<div className="resource-grid">{adminResources.data.map(r=><ResourceCard key={r.id} resource={r} user={user}/>)}</div>:<DataState title="No recent resources" text="Resources shared with your campus will appear here." icon={<BookOpen size={22}/>}/>}</>}
  </>;
}

function SettingsPage({user}:{user:Profile|null}) {
  const isAdmin = user?.role === 'admin' || user?.role === 'subadmin';
  return <><PageHeading eyebrow="PLATFORM PREFERENCES" title="Settings & integrations" description="Connect the services that bring your ClassFlow campus to life."/>
  <div className="integration-card glass-panel" style={{marginBottom:'16px'}}>
    <span className="setting-lock" style={{background:'rgba(2,132,199,0.12)',color:'#0284c7'}}><ShieldCheck size={18}/></span>
    <div className="integration-details">
      <span className="integration-type">CAMPUS GOVERNANCE</span>
      <h3>Admin Studio Access</h3>
      <p>Appoint Subadmins, assign work duties, publish campus broadcasts, and track total joined users.</p>
    </div>
    <span className={`status-pill ${isAdmin?'connected':'normal'}`}><i/>{isAdmin?(user?.role==='admin'?'Administrator':'Subadmin'):'Member account'}</span>
    <div className="integration-footer">
      <div className="integration-footnote">{isAdmin?'You have moderator/admin access to Campus Studio.':'Campus management requires an Admin (e.g. ashish_17) or appointed Subadmin account.'}</div>
      <Link to="/admin" className="button button-secondary compact"><ShieldCheck size={14}/> Open Admin Studio</Link>
    </div>
  </div>
  <div className="settings-intro glass-panel"><span className="setting-lock"><LockKeyhole size={18}/></span><div><h3>Credentials stay server-side</h3><p>Supabase's public client key is designed for browser use under RLS. Service-role keys, AI credentials and LiveKit secrets must only be saved through a protected server-side configuration endpoint.</p></div><span className="security-badge"><ShieldCheck size={14}/> Secrets server-side</span></div><div className="integration-card glass-panel"><div className="integration-logo supabase-logo">S</div><div className="integration-details"><span className="integration-type">DATABASE & AUTH</span><h3>Supabase</h3><p>Postgres, accounts, private file storage and realtime updates.</p></div><span className={`status-pill ${backendConfigured?'connected':'not-connected'}`}><i/>{backendConfigured?'Client configured':'Not configured'}</span><div className="integration-footer"><div className="integration-footnote">{backendConfigured?'Project URL and publishable key detected in the browser build.':'The project URL and public/publishable key initialize the browser client.'}</div><button className="button button-secondary compact" onClick={()=>toast(backendConfigured?'Supabase client is configured. Verify server access in your project dashboard.':'See the .env.example and README for the secure initial setup steps.')}><CircleHelp size={14}/> Setup instructions</button></div></div>
  <div className="integrations-grid"><IntegrationCard icon={<Sparkles size={18}/>} name="AI provider" detail="Groq Llama 3.3 · server-side · 40 requests/day" status="Key stored · test pending" configured/><IntegrationCard icon={<Activity size={18}/>} name="LiveKit" detail="Secure audio and video calls" status="Not configured"/><IntegrationCard icon={<Send size={18}/>} name="Email provider" detail="Transactional campus notifications" status="Not configured"/></div>
  <div className="safe-config-note"><ShieldCheck size={17}/><div><b>Provider keys stay out of the browser</b><p>Groq credentials are stored as Supabase Edge Function secrets and are never included in this frontend. The key is configured, but a successful model response still needs an authenticated Copilot smoke test. Rotate it through Supabase secrets management. Document extraction, embeddings and LiveKit remain separate integrations.</p></div></div>
  <div className="settings-footer"><span>Signed in as {user?.full_name||'Guest'}</span><span>Application setup guide is included in <code>README.md</code></span></div></>; }
function IntegrationCard({icon,name,detail,status,configured=false}:{icon:React.ReactNode;name:string;detail:string;status:string;configured?:boolean}) { return <div className="integration-card small-integration glass-panel"><span className="integration-icon">{icon}</span><div><h3>{name}</h3><p>{detail}</p></div><span className={`status-pill ${configured?'connected':'not-connected'}`}><i/>{status}</span><button className="integration-action" title={configured?`${name} is configured server-side; its secret is hidden from this app.`:`${name} is not configured.`} onClick={()=>toast(configured?`${name} is configured server-side; the secret is not available in this app.`:`${name} needs server-side provider credentials.`)}><Settings size={14}/></button></div>; }

const signupSchema=z.object({full_name:z.string().trim().min(2,'Enter your name.').max(80,'Name must be 80 characters or fewer.'),username:z.string().trim().min(3,'Username must be at least 3 characters.').max(24,'Username must be 24 characters or fewer.').regex(/^[a-zA-Z0-9_]+$/,'Use only letters, numbers, and underscores in your username.'),password:z.string().min(6,'Use at least 6 characters.')});
function AuthPage({onSuccess}:{onSuccess:()=>void}) { const params=new URLSearchParams(useLocation().search);const [mode,setMode]=useState<'login'|'signup'>(params.get('mode')==='signup'?'signup':'login');const [showPassword,setShowPassword]=useState(false);const [form,setForm]=useState({full_name:'',username:'',password:''});const [error,setError]=useState('');const [busy,setBusy]=useState(false);const navigate=useNavigate();const set=(key:keyof typeof form,value:string)=>setForm(old=>({...old,[key]:value}));
  async function submit(e:FormEvent){
    e.preventDefault();setError('');
    if(!supabase){setError('ClassFlow sign-in is not active yet. Add Supabase credentials to the deployment and try again.');return;}
    if(mode==='signup'){
      const check=signupSchema.safeParse(form);
      if(!check.success){setError(check.error.issues[0]?.message||'Review the fields and try again.');return;}
    }else if(!form.username.trim()||!form.password){setError('Enter your ID and password.');return;}
    setBusy(true);
    try{
      if(mode==='signup'){
        const username=form.username.trim().toLowerCase();
        const {data,error}=await supabase.auth.signUp({email:`${username}@users.classflow.invalid`,password:form.password,options:{data:{full_name:form.full_name.trim(),username}}});
        if(error)throw error;
        if(!data.session){setError('Could not create your account. The username may already be taken; try another one.');setMode('signup');}
        else{onSuccess();navigate('/dashboard');}
      }else{
        const {data,error}=await supabase.functions.invoke('student-login',{body:{identifier:form.username.trim(),password:form.password}});
        if(error)throw error;
        if(data?.error)throw new Error(data.error);
        if(!data?.session?.access_token||!data?.session?.refresh_token)throw new Error('Sign-in could not be completed. Check your ID and password.');
        const {error:sessionError}=await supabase.auth.setSession({access_token:data.session.access_token,refresh_token:data.session.refresh_token});
        if(sessionError)throw sessionError;
        onSuccess();navigate('/dashboard');
      }
    }catch(err){
      const message=err instanceof Error?err.message:'Authentication could not be completed.';
      setError(/username.*(taken|unique)|duplicate key|already registered/i.test(message)?'That username is already taken. Choose another one.':message);
    }finally{setBusy(false);}
  }
  const input=(key:keyof typeof form,label:string,type='text',placeholder='')=><label className="field"><span>{label}</span><input type={type==='password'&&!showPassword?'password':type==='password'?'text':type} value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={placeholder} autoComplete={key==='password'?(mode==='signup'?'new-password':'current-password'):key==='username'?'username':'name'}/></label>;
  return <div className="auth-layout"><div className="auth-visual"><Link to="/" className="brand"><img className="brand-glyph" src="/classflow-mark.webp" alt=""/><span>ClassFlow</span></Link><div className="auth-visual-copy"><div className="eyebrow">YOUR CAMPUS, IN FLOW</div><h1>Learning feels<br/><em>lighter together.</em></h1><p>Keep class resources, campus connections and everyday learning in one calm place.</p><div className="auth-visual-card glass-panel"><span><BookOpen size={17}/></span><div><b>Your academic hub</b><small>Notes, assignments & campus life — in one place.</small></div><ArrowRight size={15}/></div></div><span className="auth-visual-foot">A little more room to learn.</span></div><div className="auth-form-wrap"><Link to="/" className="back-link"><ArrowLeft size={15}/> Back to ClassFlow</Link><div className="auth-form-card"><div className="auth-form-heading"><span className="eyebrow">{mode==='signup'?'WELCOME TO YOUR CAMPUS':'YOUR CAMPUS IS HERE'}</span><h2>{mode==='signup'?'Create your account':'Welcome back'}</h2><p>{mode==='signup'?'Create your account with just your name, username and password.':'Sign in with your ClassFlow ID and password.'}</p></div>
      {!backendConfigured&&<div className="auth-warning"><AlertCircle size={16}/><span>Authentication is not configured yet. Add your Supabase project settings to activate accounts.</span></div>}
      <form onSubmit={submit} className="auth-form"><div className="auth-fields">{mode==='signup'&&<>{input('full_name','Name','text','Your name')}{input('username','Username','text','Choose a username')}</>}{mode==='login'&&input('username','ID or username','text','Your ClassFlow username or ID')}<label className="field password-field"><span>Password</span><div><input type={showPassword?'text':'password'} value={form.password} onChange={e=>set('password',e.target.value)} placeholder={mode==='signup'?'At least 6 characters':'Your password'} autoComplete={mode==='signup'?'new-password':'current-password'}/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label></div>
        {mode==='login'&&<div className="forgot-row">Forgot your password? Contact your ClassFlow admin for help.</div>}
        {error&&<div className="auth-error"><AlertCircle size={15}/>{error}</div>}<button type="submit" className="button button-primary auth-submit" disabled={busy}>{busy?<><RefreshCw size={15} className="spin"/> Please wait…</>:<>{mode==='signup'?'Create account':'Sign in'} <ArrowRight size={15}/></>}</button>
      </form><div className="auth-switch">{mode==='signup'?'Already have an account?':'New to ClassFlow?'} <button onClick={()=>{setMode(mode==='signup'?'login':'signup');setError('');}}>{mode==='signup'?'Sign in':'Create an account'}</button></div><div className="auth-legal">By continuing, you agree to use your campus space respectfully and keep shared learning resources safe.</div></div></div></div>;
}
export default App;
