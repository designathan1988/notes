import { useEffect,useRef,useState } from 'react';
import { EditorContent,useEditor,type Editor as TiptapEditor } from '@tiptap/react';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold,Italic,Code2,List,CheckSquare,Heading2,Link,Plus,Paperclip,Quote,Undo2,Redo2,Type,Minus,Video,Table2 } from 'lucide-react';
import { editorExtensions,projectDocument } from '../../../../packages/editor/src/schema.js';
import { DocumentSession } from './session.js';
import { useWorkspace } from '../state/store.js';
import { IconButton } from '../ui/IconButton.js';
import { Dialog } from '../ui/Dialog.js';
import type { Page } from '../../../../packages/contracts/src/index.js';
import { captureClipboard,uploadFile,fileNode,type CapturedFile } from './capture.js';
import { safeEmbedSource } from '../../../../packages/editor/src/embeds.js';

export function DocumentEditor({page}: {page:Page}){
  const [session,setSession]=useState<DocumentSession|null>(null);
  useEffect(()=>{const next=new DocumentSession(page);void next.start().then(()=>{if(!next.destroyed)setSession(next);}).catch(useWorkspace.getState().setError);return()=>{void next.destroy();};},[page.id,page.generation]);
  return session ? <ConnectedEditor session={session}/> : <p className="editor-prompt">Opening document…</p>;
}
function ConnectedEditor({session}:{session:DocumentSession}){
  const [commands,setCommands]=useState(false);const [linkOpen,setLinkOpen]=useState(false);
  const [embedOpen,setEmbedOpen]=useState(false);const [pasteMode,setPasteMode]=useState('auto');const [uploading,setUploading]=useState(0);const [failed,setFailed]=useState<File[]>([]);const fileInput=useRef<HTMLInputElement>(null);
  async function upload(file:File):Promise<CapturedFile>{setUploading(count=>count+1);try{return await uploadFile(session.page.id,file);}catch(error){setFailed(files=>[...files,file]);throw error;}finally{setUploading(count=>count-1);}}
  const editor=useEditor({
    extensions:[...editorExtensions(),Collaboration.configure({document:session.doc}),CollaborationCaret.configure({provider:session.provider,user:{name:useWorkspace.getState().user?.name,color:'#39745f'}}),Placeholder.configure({placeholder:'Write something, or type / for commands…'})],
    editable:!session.readOnly,enableContentCheck:true,
    onContentError:()=>useWorkspace.getState().setError('This document contains unsupported content. Export a recovery copy before continuing.'),
    editorProps:{attributes:{class:'note-editor','aria-label':'Page content',role:'textbox','aria-multiline':'true'},
      handleClick:(_view,_position,event)=>{const target=(event.target as HTMLElement).closest<HTMLElement>('[data-page-link],[data-wiki-link]');if(target){event.preventDefault();useWorkspace.getState().navigate(target.dataset.pageLink ?? target.dataset.wikiLink ?? null);return true;}return false;},
      handleKeyDown:(view,event)=>{if(event.key==='/' && view.state.selection.$from.parent.type.name==='paragraph' && view.state.selection.$from.parent.textContent===''){event.preventDefault();setCommands(true);return true;}return false;},
      handlePaste:(_view,event)=>{if(!event.clipboardData)return false;const input={text:event.clipboardData.getData('text/plain'),html:event.clipboardData.getData('text/html'),files:[...event.clipboardData.files],mode:editor?.isActive('codeBlock') ? 'code' : pasteMode};event.preventDefault();if(editor)void captureClipboard(editor,input,upload,useWorkspace.getState().setError).catch(useWorkspace.getState().setError);return true;},
      handleDrop:(_view,event)=>{const files=[...(event.dataTransfer?.files ?? [])];if(!files.length)return false;event.preventDefault();for(const file of files)void upload(file).then(result=>editor?.chain().focus().insertContent(fileNode(result)).run()).catch(useWorkspace.getState().setError);return true;},
    },
  },[session]);
  useEffect(()=>{if(!editor)return;const update=()=>{const projection=projectDocument(editor.getJSON());useWorkspace.setState({outline:projection.headings,linkedPageIds:projection.links});};update();editor.on('update',update);return()=>{editor.off('update',update);};},[editor]);
  if(!editor)return null;
  return <div className="editor-wrap"><EditorContent editor={editor}/>{uploading>0 && <p className="upload-status" role="status">Uploading {uploading} {uploading===1 ? 'file' : 'files'}… Keep this tab open.</p>}{failed.map((file,index)=><FailedFile key={index} file={file} retry={()=>{setFailed(files=>files.filter((_,i)=>i!==index));void upload(file).then(result=>editor.chain().focus().insertContent(fileNode(result)).run()).catch(useWorkspace.getState().setError);}}/>)}<input ref={fileInput} type="file" multiple hidden aria-label="Choose attachments" onChange={event=>{for(const file of [...(event.target.files ?? [])])void upload(file).then(result=>editor.chain().focus().insertContent(fileNode(result)).run()).catch(useWorkspace.getState().setError);event.target.value='';}}/>{!session.readOnly && <div className="document-tools" role="toolbar" aria-label="Document formatting">
    <IconButton label="Insert block" onClick={()=>setCommands(true)}><Plus/></IconButton><span className="tool-divider"/>
    <IconButton label="Bold" aria-pressed={editor.isActive('bold')} onClick={()=>editor.chain().focus().toggleBold().run()}><Bold/></IconButton>
    <IconButton label="Italic" aria-pressed={editor.isActive('italic')} onClick={()=>editor.chain().focus().toggleItalic().run()}><Italic/></IconButton>
    <IconButton label="Insert link" onClick={()=>setLinkOpen(true)}><Link/></IconButton>
    <IconButton label="Add attachment" onClick={()=>fileInput.current?.click()}><Paperclip/></IconButton>
    <span className="desktop-tool"><IconButton label="Undo" onClick={()=>editor.commands.undo()}><Undo2/></IconButton><IconButton label="Redo" onClick={()=>editor.commands.redo()}><Redo2/></IconButton><select aria-label="Paste mode" value={pasteMode} onChange={event=>setPasteMode(event.target.value)}><option value="auto">Auto paste</option><option value="text">Plain text</option><option value="markdown">Markdown</option><option value="code">Code</option></select></span>
  </div>}
  {commands && <Dialog title="Add a block" onClose={()=>setCommands(false)}><div className="block-menu">{[
    [Type,'Text',()=>editor.chain().focus().setParagraph().run()],
    [Heading2,'Heading',()=>editor.chain().focus().toggleHeading({level:2}).run()],
    [List,'Bullet list',()=>editor.chain().focus().toggleBulletList().run()],
    [CheckSquare,'Checklist',()=>editor.chain().focus().toggleTaskList().run()],
    [Code2,'Code block',()=>editor.chain().focus().toggleCodeBlock().run()],
    [Quote,'Quote',()=>editor.chain().focus().toggleBlockquote().run()],
    [Minus,'Divider',()=>editor.chain().focus().setHorizontalRule().run()],
    [Table2,'Table',()=>editor.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run()],
    [Video,'Video embed',()=>setEmbedOpen(true)],
  ].map(([Icon,label,action])=>{const Glyph=Icon as typeof Type;return <button key={String(label)} onClick={()=>{(action as ()=>void)();setCommands(false);}}><Glyph/><span>{String(label)}</span></button>;})}</div></Dialog>}
  {linkOpen && <LinkPicker editor={editor} close={()=>setLinkOpen(false)}/>}{embedOpen && <Dialog title="Embed a video" onClose={()=>setEmbedOpen(false)}><form onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);const url=String(data.get('url'));if(!safeEmbedSource(url)){useWorkspace.getState().setError('Use a YouTube or Vimeo video URL.');return;}editor.chain().focus().insertContent({type:'embed',attrs:{url,title:String(data.get('title') || 'Embedded video')}}).run();setEmbedOpen(false);}}><label>Video URL<input type="url" name="url" required placeholder="https://…"/></label><label>Title<input name="title" placeholder="Embedded video"/></label><button className="button primary">Insert video</button></form></Dialog>}</div>;
}
function FailedFile({file,retry}:{file:File;retry():void}){const [url,setUrl]=useState('');useEffect(()=>{const next=URL.createObjectURL(file);setUrl(next);return()=>URL.revokeObjectURL(next);},[file]);return <div className="upload-failure"><span>Upload failed: {file.name}</span><button onClick={retry}>Retry</button><a download={file.name} href={url}>Save original</a></div>;}
function LinkPicker({editor,close}:{editor:TiptapEditor;close():void}){
  const pages=useWorkspace(state=>state.pages);const [query,setQuery]=useState('');
  return <Dialog title="Connect an idea" onClose={close}><label>Find a page or enter a URL<input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search pages or https://…"/></label><div className="link-results">{pages.filter(page=>page.title.toLowerCase().includes(query.toLowerCase())).slice(0,12).map(page=><button key={page.id} onClick={()=>{editor.chain().focus().insertContent({type:'wikiLink',attrs:{targetId:page.id,label:page.title}}).run();close();}}><Link size={16}/>{page.title}</button>)}{/^https?:\/\//i.test(query) && <button onClick={()=>{editor.chain().focus().insertContent({type:'text',text:query,marks:[{type:'link',attrs:{href:query}}]}).run();close();}}>Link to {query}</button>}</div></Dialog>;
}
