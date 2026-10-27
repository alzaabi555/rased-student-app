import React, { useEffect, useMemo, useState } from 'react';
import { Mail, MessageCircle, RefreshCw, Send, X } from 'lucide-react';

const MESSAGES_URL = 'https://script.google.com/macros/s/AKfycbwMYqSpnXvlMrL6po82-XePyAWBd9FMNCTgY7WlYaOH6pn1kTazLqxEfvremqsSk_dU/exec';

type MessageItem = { id:string; conversationId:string; subject:string; message:string; senderType:'student'|'teacher'; isRead:boolean; createdAt:string; status:string };
type Props = { student:any };

export default function StudentMessages({ student }: Props) {
  const identity = useMemo(() => ({
    studentId: String(student?.id || student?.studentId || student?.rasedId || ''),
    centralStudentId: String(student?.centralStudentId || ''),
    rasedId: String(student?.rasedId || ''),
    centralRasedId: String(student?.centralRasedId || student?.rasedId || ''),
    legacyRasedIds: Array.isArray(student?.legacyRasedIds) ? student.legacyRasedIds : [],
    studentName: String(student?.name || ''), schoolName: String(student?.schoolName || ''), schoolId: String(student?.schoolId || ''), schoolCode: String(student?.schoolCode || ''),
  }), [student]);
  const [messages,setMessages]=useState<MessageItem[]>([]); const [subject,setSubject]=useState(''); const [text,setText]=useState(''); const [loading,setLoading]=useState(false); const [notice,setNotice]=useState('');
  const conversations=useMemo(()=>{const groups:Record<string,MessageItem[]>={};messages.forEach(m=>(groups[m.conversationId] ||= []).push(m));return Object.values(groups).sort((a,b)=>new Date(b[b.length-1]?.createdAt||0).getTime()-new Date(a[a.length-1]?.createdAt||0).getTime());},[messages]);
  async function post(body:any){const response=await fetch(MESSAGES_URL,{method:'POST',body:JSON.stringify(body)});const payload=await response.json();if(!response.ok||payload?.success===false)throw new Error(payload?.error||'تعذر الاتصال بخدمة المراسلات.');return payload.data;}
  async function refresh(){setLoading(true);try{const data=await post({action:'getStudentMessages',...identity});setMessages(Array.isArray(data)?data:[]);setNotice('');}catch(e){setNotice(e instanceof Error?e.message:'تعذر تحديث الرسائل.');}finally{setLoading(false);}}
  useEffect(()=>{void refresh();},[identity.centralStudentId,identity.rasedId]);
  async function send(){if(!subject.trim()||!text.trim())return;setLoading(true);try{const sourceMessageId=`student_message_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;await post({action:'saveStudentMessage',...identity,sourceMessageId,conversationId:`conversation_${sourceMessageId}`,subject:subject.trim(),message:text.trim()});setSubject('');setText('');setNotice('تم إرسال الرسالة إلى المعلم.');await refresh();}catch(e){setNotice(e instanceof Error?e.message:'تعذر إرسال الرسالة.');}finally{setLoading(false);}}
  return <div dir="rtl" className="h-full overflow-y-auto bg-slate-50 p-4 pb-28 text-slate-900">
    <header className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-emerald-700 font-black"><Mail className="h-5 w-5"/> مراسلاتي</div><p className="mt-1 text-xs font-bold text-slate-500">أرسل استفسارك وتابع رد المعلم.</p></div><button type="button" onClick={()=>void refresh()} className="rounded-2xl bg-emerald-50 p-3 text-emerald-700"><RefreshCw className={`h-5 w-5 ${loading?'animate-spin':''}`}/></button></div></header>
    {notice&&<div className="mb-4 flex items-center justify-between rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-800"><span>{notice}</span><button type="button" onClick={()=>setNotice('')}><X className="h-4 w-4"/></button></div>}
    <section className="mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-3 font-black">رسالة جديدة</h2><input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="موضوع الرسالة" className="mb-3 w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-emerald-400"/><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="اكتب رسالتك بوضوح..." rows={4} className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-emerald-400"/><button type="button" onClick={()=>void send()} disabled={loading||!subject.trim()||!text.trim()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 font-black text-white disabled:bg-slate-200"><Send className="h-4 w-4"/> إرسال</button></section>
    <section className="space-y-4"><h2 className="font-black">المحادثات</h2>{conversations.length===0?<div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500"><MessageCircle className="mx-auto mb-2 h-8 w-8"/>لا توجد محادثات بعد.</div>:conversations.map(group=><article key={group[0].conversationId} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="mb-3 font-black">{group[0].subject||'عام'}</h3><div className="space-y-2">{group.map(m=><div key={m.id} className={`max-w-[88%] rounded-2xl p-3 text-sm font-bold leading-7 ${m.senderType==='student'?'mr-auto bg-emerald-50 text-emerald-900':'ml-auto bg-slate-100 text-slate-800'}`}><p>{m.message}</p><p className="mt-1 text-[9px] text-slate-400">{m.senderType==='student'?'أنت':'المعلم'} · {new Date(m.createdAt).toLocaleString('ar-OM')}</p></div>)}</div></article>)}</section>
  </div>;
}
