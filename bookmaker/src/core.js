import { marked } from 'marked';
import DOMPurify from 'dompurify';
import TurndownService from 'turndown';
export const uid = () => crypto.randomUUID();
export const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const xml = s => esc(s).replace(/[^\x09\x0a\x0d\x20-\ud7ff\ue000-\ufffd]/g,'');
export function clean(html) {
  return DOMPurify.sanitize(html,{ADD_TAGS:['note','right','center','empty-line'],ADD_ATTR:['data-wiki'],FORBID_TAGS:['style','input','button','form','iframe','video','audio'],FORBID_ATTR:['style','id']});
}
const td=new TurndownService({headingStyle:'atx',bulletListMarker:'-',codeBlockStyle:'fenced'});
td.addRule('extended',{filter:['u','sub','sup','note','center','right','empty-line'],replacement:(content,node)=>node.nodeName==='EMPTY-LINE'?'\n\n<empty-line>\n\n':`<${node.nodeName.toLowerCase()}>${content}</${node.nodeName.toLowerCase()}>`});
td.addRule('wiki',{filter:n=>n.nodeName==='A'&&n.hasAttribute('data-wiki'),replacement:(c,n)=>`[[${n.getAttribute('data-wiki')}${c!==n.getAttribute('data-wiki')?'|'+c:''}]]`});
td.addRule('strike',{filter:['s','del','strike'],replacement:c=>`~~${c}~~`});
export function fromHTML(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  doc.querySelectorAll('[style]').forEach(n=>{const s=n.style;if(s.fontWeight==='bold'||Number(s.fontWeight)>=600)n.innerHTML='<strong>'+n.innerHTML+'</strong>';if(s.fontStyle==='italic')n.innerHTML='<em>'+n.innerHTML+'</em>';if(s.textDecoration.includes('underline'))n.innerHTML='<u>'+n.innerHTML+'</u>';if(['center','right'].includes(s.textAlign))n.innerHTML=`<${s.textAlign}>${n.innerHTML}</${s.textAlign}>`;});
  return td.turndown(clean(doc.body.innerHTML));
}
export function render(md){
  const normalized=String(md||'').replace(/\[(\/?(?:b|i|u|s|center|right|note|empty-line|hr))\]/gi,'<$1>');
  return clean(marked.parse(normalized,{breaks:true,gfm:true})).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(_,target,label)=>`<a href="#wiki" data-wiki="${esc(target)}">${esc(label||target)}</a>`);
}
export const plain = md => {const d=new DOMParser().parseFromString(render(md),'text/html');return d.body.textContent||'';};
export const words = md => (plain(md).match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)||[]).length;
export function newBook(title='Новая книга') {return {schema:1,id:uid(),title,author:'',description:'',language:'ru',genre:'',tags:'',rating:'G',fandom:'Ориджинал',pairing:'',status:'В процессе',rights:'',publisher:'',isbn:'',date:new Date().toISOString().slice(0,10),cover:'',goal:50000,nodes:[{id:uid(),type:'chapter',title:'Первая глава',parent:null,content:''}],wiki:[],updatedAt:new Date().toISOString()};}
export function ordered(book){const out=[];for(const n of book.nodes.filter(n=>!n.parent)){out.push(n);if(n.type==='part')out.push(...book.nodes.filter(c=>c.parent===n.id));}return out;}
export function validateBook(b){
  if(!b||b.schema!==1||!Array.isArray(b.nodes)||!Array.isArray(b.wiki)||typeof b.title!=='string')throw new Error('Это не файл книги BookMaker.');
  if(b.nodes.length>10000||b.wiki.length>10000)throw new Error('Слишком много страниц.');
  const ids=new Set();for(const n of [...b.nodes,...b.wiki]){if(typeof n.id!=='string'||!/^[\w-]{1,80}$/.test(n.id)||ids.has(n.id)||typeof n.title!=='string'||typeof n.content!=='string')throw new Error('Повреждённая структура книги.');ids.add(n.id);}
  for(const n of b.nodes){if(!['chapter','part'].includes(n.type)||n.parent&&(n.type!=='chapter'||!b.nodes.some(p=>p.id===n.parent&&p.type==='part'&&!p.parent)))throw new Error('Некорректное древо глав.');}
  if(!b.nodes.some(n=>n.type==='chapter'))throw new Error('В книге нет глав.');
  const result={...newBook(),...b,id:typeof b.id==='string'&&/^[\w-]{1,80}$/.test(b.id)?b.id:uid()};
  for(const key of ['author','description','language','genre','tags','rating','fandom','pairing','status','rights','publisher','isbn','date'])if(typeof result[key]!=='string')throw new Error('Повреждены метаданные книги.');
  if(result.cover&&(!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(result.cover)||result.cover.length>15000000))throw new Error('Некорректная обложка.');
  result.wiki=result.wiki.map(n=>({...n,category:typeof n.category==='string'?n.category:'Заметки'}));result.goal=Math.max(1,Number(result.goal)||50000);result.revision=Number(result.revision)||0;result.updatedAt=typeof result.updatedAt==='string'&&!isNaN(Date.parse(result.updatedAt))?result.updatedAt:new Date().toISOString();return result;
}
export function siteText(md,site='fanfics') {
  const doc=new DOMParser().parseFromString(render(md),'text/html');
  function walk(n){if(n.nodeType===3)return n.textContent;const t=n.nodeName.toLowerCase(),c=[...n.childNodes].map(walk).join('');const tag={strong:'b',em:'i',del:'s',b:'b',i:'i',u:'u',s:'s',center:'center',right:'right',note:'note'}[t];
    if(tag){if(site==='ficbook'&&tag==='note')return ` (${c})`;return site==='fanfics'?`<${tag}>${c}</${tag}>`:`[${tag}]${c}[/${tag}]`;}
    if(t==='hr')return '\n\n* * *\n\n';if(t==='empty-line')return site==='fanfics'?'\n<empty-line>\n':'\n\n';if(t==='br')return '\n';if(t==='li')return '• '+c+'\n';if(/^(p|div|h[1-6]|blockquote|ul|ol|pre)$/.test(t))return c+'\n\n';return c;}
  return walk(doc.body).replace(/\n{3,}/g,'\n\n').trim();
}
export function demoBook(){const b=newBook('Там, где просыпается ветер');b.author='';b.genre='Фэнтези';b.description='История о забытом городе, картах и дорогах, которые выбирают нас.';const part=uid();b.nodes=[{id:part,type:'part',parent:null,title:'За краем карты',content:''},{id:uid(),type:'chapter',parent:part,title:'Дом у тихой воды',content:'Утром озеро было совершенно неподвижным. На другом берегу лес ещё спал, укрывшись тонким одеялом тумана.\n\nМира открыла окно. В комнату вошёл запах мокрой травы, прохлада и далёкий, почти неслышный звон. Так начинался каждый день в [[Тихая гавань|Тихой гавани]] — но сегодня что-то изменилось.\n\n— Ты тоже это слышишь? — спросил [[Элиан]], не оборачиваясь.\n\nНа столе лежала карта. Вчера за северным хребтом было только белое пятно. Теперь там проступали очертания города.\n\n*Города, которого не должно было существовать.*\n\n* * *\n\nМира провела пальцем по новой линии берега. Бумага оказалась тёплой.\n\n— Пожалуй, пора в дорогу.\n\nВпервые за много лет она произнесла это без страха.'},{id:uid(),type:'chapter',parent:part,title:'Письмо без адреса',content:''},{id:uid(),type:'chapter',parent:null,title:'На север',content:''}];b.wiki=[{id:uid(),title:'Мира',category:'Персонажи',content:'Картограф. Замечает то, что остальные привыкли не видеть.\n\n**Цель:** найти исчезнувший город.\n\n**Связи:** [[Элиан]]'},{id:uid(),title:'Элиан',category:'Персонажи',content:'Хранитель старой библиотеки.\n\nЗнает историю каждой карты, но о своей рассказывать не любит.'},{id:uid(),title:'Тихая гавань',category:'Локации',content:'Небольшой город на берегу озера, окружённый лесом и северным хребтом.'}];return b;}
