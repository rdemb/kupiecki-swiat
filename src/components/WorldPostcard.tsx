import {useEffect,useRef,useState,type RefObject} from 'react';

export type SceneCamera=RefObject<null|(()=>Promise<Blob|null>)>;

export function WorldPostcard({camera,place}:{camera:SceneCamera;place:string}){
  const [picture,setPicture]=useState<Blob|null>(null);
  const [link,setLink]=useState(''),[status,setStatus]=useState<'ready'|'busy'|'error'>('ready');
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    if(!picture)return;
    const url=URL.createObjectURL(picture);
    setLink(url);dialog.current?.showModal();
    return ()=>URL.revokeObjectURL(url);
  },[picture]);
  async function capture(){
    setStatus('busy');
    try{
      const frame=await camera.current?.();
      if(!frame)throw new Error();
      setPicture(frame);setStatus('ready');
    }catch{setStatus('error');}
  }
  return <>
    <button type="button" className="atlas-expand" disabled={status==='busy'} onClick={()=>void capture()}>
      {status==='busy'?'Wywoływanie…':status==='error'?'Ponów zdjęcie':'Zrób pocztówkę'}
    </button>
    {picture && <dialog ref={dialog} className="world-postcard" onClose={()=>{setLink('');setPicture(null);}} aria-label="Pocztówka z podróży">
      {link && <img src={link} alt={'Kadr z gry · '+place}/>}
      <footer><strong>{place}</strong><a download={'Kupiecki Świat — '+place+'.png'} href={link}>Zapisz PNG</a>
        <button onClick={()=>dialog.current?.close()}>Zamknij</button></footer>
    </dialog>}
  </>;
}
