import { DomainError,type RecordField } from '../../../../packages/contracts/src/index.js';
export const defaultFields:RecordField[]=[{id:'type',name:'Type',type:'select',options:['Research','Document','Collection']},{id:'status',name:'Status',type:'select',options:['Planned','In progress','Active','Draft','Evergreen']},{id:'priority',name:'Priority',type:'select',options:['High','Medium','Low']}];
export function validateFields(fields:RecordField[]){
  if(!Array.isArray(fields) || fields.length>50)throw new DomainError('INVALID','Use up to 50 properties.');const ids=new Set<string>();
  for(const field of fields){if(!/^[\w-]{1,64}$/.test(field.id) || !field.name?.trim() || field.name.length>100 || !['text','number','checkbox','select','multi-select','date','url','relation'].includes(field.type) || ids.has(field.id))throw new DomainError('INVALID','Properties need unique IDs, names, and supported types.');ids.add(field.id);
    if(['select','multi-select'].includes(field.type) && (!Array.isArray(field.options) || field.options.length>100 || field.options.some(value=>typeof value!=='string' || !value || value.length>100)))throw new DomainError('INVALID','Select properties need valid options.');
  }return fields;
}
export function validateValues(fields:RecordField[],values:Record<string,unknown>){
  if(!values || typeof values!=='object' || Array.isArray(values))throw new DomainError('INVALID','Record values must be an object.');
  for(const [id,value] of Object.entries(values)){
    const field=fields.find(item=>item.id===id);if(!field)throw new DomainError('INVALID',`Unknown property: ${id}`);if(value===null || value==='')continue;
    let valid=false;
    switch(field.type){
      case 'text':valid=typeof value==='string' && value.length<=10000;break;
      case 'number':valid=typeof value==='number' && Number.isFinite(value);break;
      case 'checkbox':valid=typeof value==='boolean';break;
      case 'select':valid=typeof value==='string' && !!field.options?.includes(value);break;
      case 'multi-select':valid=Array.isArray(value) && value.length<=100 && value.every(item=>typeof item==='string' && field.options?.includes(item));break;
      case 'date':valid=typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));break;
      case 'url':try{valid=typeof value==='string' && ['https:','http:'].includes(new URL(value).protocol);}catch{}break;
      case 'relation':valid=typeof value==='string' && value.length<=128;break;
    }if(!valid)throw new DomainError('INVALID',`Invalid value for ${field.name}.`);
  }
}
