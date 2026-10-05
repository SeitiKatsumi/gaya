'use client';
import {useEffect} from 'react';

function openSection(section:string){const target=document.getElementById(section);if(target instanceof HTMLDetailsElement)target.open=true;}

export function ReportSectionNav({sections}:{sections:string[]}){
  useEffect(()=>{try{openSection(decodeURIComponent(location.hash.slice(1)));}catch{}},[sections]);
  return <nav className="report-section-nav" aria-label="Seções do relatório">{sections.map(section=><a href={`#${encodeURIComponent(section)}`} key={section} onClick={()=>openSection(section)}>{section}</a>)}</nav>;
}
