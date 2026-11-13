import { create } from 'zustand';

type ToastItem={id:number;message:string};
type UIState={toasts:ToastItem[];pushToast:(message:string)=>void;dismissToast:(id:number)=>void};
export const useUIStore=create<UIState>((set)=>({
  toasts:[],
  pushToast:(message)=>{const id=Date.now()+Math.random();set((state)=>({toasts:[...state.toasts,{id,message}].slice(-4)}));window.setTimeout(()=>set((state)=>({toasts:state.toasts.filter((toast)=>toast.id!==id)})),3600);},
  dismissToast:(id)=>set((state)=>({toasts:state.toasts.filter((toast)=>toast.id!==id)})),
}));
