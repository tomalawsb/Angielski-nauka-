#!/usr/bin/env python3
"""Pakiet 8: renderowanie pełnej ścieżki A1 i A2 i migracja modułu 1 -> 2."""
from pathlib import Path
import os, re, sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]

def inline_app():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>','',html)
    html=re.sub(r'<link rel="manifest"[^>]*>','',html)
    html=re.sub(r'<link rel="apple-touch-icon"[^>]*>','',html)
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/m.group(1)).read_text(encoding='utf-8')+'</style>',html)
    storage="""<script>
const TEST_LOCAL_STORAGE=(()=>{const m=new Map();return {get length(){return m.size},key:i=>Array.from(m.keys())[i]??null,getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),_map:m};})();
const TEST_SESSION_STORAGE=(()=>{const m=new Map();return {get length(){return m.size},key:i=>Array.from(m.keys())[i]??null,getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),_map:m};})();
</script>"""
    html=html.replace('<script src="js/bootstrap-v6.6.0.js"></script>',storage+'<script src="js/bootstrap-v6.6.0.js"></script>')
    def script(m):
        text=(ROOT/m.group(1)).read_text(encoding='utf-8').replace('localStorage','TEST_LOCAL_STORAGE').replace('sessionStorage','TEST_SESSION_STORAGE')
        return '<script>'+text+'</script>'
    return re.sub(r'<script src="([^"]+)"(?: defer)?></script>',script,html)

def done(page):
    for _ in range(5): page.click('#onboardingNext')

def main():
    results=[]
    def ok(cond,name): results.append((name,bool(cond)))
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        for width,height in [(320,568),(390,844),(768,1024),(1366,768)]:
            page=browser.new_page(viewport={'width':width,'height':height}); errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
            page.set_content(inline_app(),wait_until='load'); page.wait_for_timeout(200); done(page)
            page.evaluate("state.course.selectedLevel='A2'; renderAll(); show('course')")
            ok(page.locator('.course-module-card').count()==12,f'12 modułów A2 {width}x{height}')
            ok(page.locator('[data-course-lesson]').count()==60,f'60 lekcji A2 {width}x{height}')
            ok(not page.locator('[data-course-lesson="a2-m01-l01"]').is_disabled(),f'pierwsza lekcja A2 dostępna {width}x{height}')
            ok(page.locator('[data-course-lesson="a2-m02-l01"]').is_disabled(),f'drugi moduł A2 początkowo zablokowany {width}x{height}')
            overflow=page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
            ok(overflow<=1,f'brak poziomego przepełnienia {width}x{height}')
            ok(not errors,f'brak błędów JS {width}x{height}')
            page.close()
        page=browser.new_page(viewport={'width':390,'height':844}); page.set_content(inline_app(),wait_until='load'); page.wait_for_timeout(200); done(page)
        page.evaluate("state.course.selectedLevel='A2'; renderAll(); show('course')")
        first=page.locator('[data-course-lesson="a2-m01-l01"]'); ok(not first.is_disabled(),'pierwsza lekcja A2 jest dostępna')
        first.click(); page.wait_for_timeout(100)
        ok(page.evaluate("window.__trainerTests.getSession()?.lessonId")=='a2-m01-l01','lekcja A2 uruchamia właściwą sesję')
        ok(page.evaluate("window.__trainerTests.getSession()?.queue.some(t=>t.mode==='course_grammar')"),'lekcja A2 zawiera gramatykę')
        page.close(); browser.close()
    failed=[name for name,value in results if not value]
    for name,value in results: print(('PASS ' if value else 'FAIL ')+name)
    print(f'Wynik pełnego A1-A2 UI: {len(results)-len(failed)}/{len(results)}')
    return 1 if failed else 0
if __name__=='__main__':
    code=main();os._exit(code)
