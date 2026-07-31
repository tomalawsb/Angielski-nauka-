#!/usr/bin/env python3
"""Pakiet 8: test ergonomii i pełnego przebiegu pełnego A1 w Chromium.
Wymaga Python Playwright i lokalnego Chromium. Nie łączy się z internetem.
"""
from pathlib import Path
import os
import re
import sys
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]

def inline_app():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>','',html)
    html=re.sub(r'<link rel="manifest"[^>]*>','',html)
    html=re.sub(r'<link rel="apple-touch-icon"[^>]*>','',html)
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+ (ROOT/m.group(1)).read_text(encoding='utf-8')+'</style>',html)
    storage="""<script>
const TEST_LOCAL_STORAGE=(()=>{const m=new Map();return {get length(){return m.size},key:i=>Array.from(m.keys())[i]??null,getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),_map:m};})();
const TEST_SESSION_STORAGE=(()=>{const m=new Map();return {get length(){return m.size},key:i=>Array.from(m.keys())[i]??null,getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),_map:m};})();
</script>"""
    html=html.replace('<script src="js/bootstrap-v6.6.0.js"></script>',storage+'<script src="js/bootstrap-v6.6.0.js"></script>')
    def script(m):
        text=(ROOT/m.group(1)).read_text(encoding='utf-8').replace('localStorage','TEST_LOCAL_STORAGE').replace('sessionStorage','TEST_SESSION_STORAGE')
        return '<script>'+text+'</script>'
    return re.sub(r'<script src="([^"]+)"(?: defer)?></script>',script,html)

def ok(condition,name,results):
    results.append((name,bool(condition)))

def complete_onboarding(page):
    for _ in range(5):
        page.locator('#onboardingNext').scroll_into_view_if_needed()
        page.click('#onboardingNext')

def answer_current(page):
    session=page.evaluate('window.__trainerTests.getSession()')
    if not session or session['index']>=len(session['queue']):
        return False
    mode=session['queue'][session['index']]['mode']
    if mode in ('course_intro','course_intro_group','course_grammar'):
        page.click('#nextBtn')
    elif mode=='word_choice':
        expected=page.evaluate('expected(curWord(),curTask().mode,curTask())')
        page.locator('.choice').filter(has_text=expected).first.click()
        page.click('#checkBtn'); page.click('#nextBtn')
    else:
        answer=page.evaluate("""()=>{const t=curTask(),w=curWord();return t.mode==='course_final'?(t.exampleAnswer||t.expectedAnswer):expected(w,t.mode,t)}""")
        page.locator('.answer').fill(answer)
        page.click('#checkBtn'); page.click('#nextBtn')
    return True

def main():
    html=inline_app(); results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        for width,height,font in [(320,568,'xlarge'),(360,640,'normal'),(390,844,'large'),(768,1024,'normal'),(1366,768,'normal')]:
            page=browser.new_page(viewport={'width':width,'height':height})
            errors=[]; page.on('pageerror',lambda e,errors=errors:errors.append(str(e)))
            page.set_content(html,wait_until='load'); page.wait_for_timeout(300)
            page.evaluate('f=>document.documentElement.dataset.fontSize=f',font)
            for step in range(1,6):
                dialog=page.locator('#onboardingDialog')
                scrollable=dialog.evaluate("e=>{const f=e.querySelector('form');return f.scrollHeight<=f.clientHeight+1||getComputedStyle(f).overflowY==='auto'}")
                ok(scrollable,f'onboarding krok {step} dostępny {width}x{height} {font}',results)
                if step<5:
                    page.locator('#onboardingNext').scroll_into_view_if_needed(); page.click('#onboardingNext')
            page.locator('#onboardingNext').scroll_into_view_if_needed(); page.click('#onboardingNext')
            overflow=page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
            ok(overflow<=1,f'brak przewijania poziomego {width}x{height} {font}',results)
            ok(not errors,f'brak błędów JS {width}x{height} {font}',results)
            page.close()

        page=browser.new_page(viewport={'width':390,'height':844})
        page.set_content(html,wait_until='load'); page.wait_for_timeout(300); complete_onboarding(page)
        page.click('[data-nav="settings"]'); page.locator('#carTaskCount').fill('25'); page.locator('#carTaskCount').dispatch_event('change'); page.locator('#carTaskCount').blur()
        ok(page.evaluate('state.settings.carTaskCount')==25,'ustawienie samochodu zapisuje się po zmianie',results)
        ok(page.evaluate("JSON.parse(TEST_LOCAL_STORAGE.getItem('angielski_daily_trainer_state_v660')).settings.carTaskCount") == 25,'ustawienie samochodu trafia do zapisu 6.6.0',results)
        page.evaluate("show('today')"); page.click('#courseContinueBtn');
        # trzy kroki i test pauzy/wznowienia
        for _ in range(3): answer_current(page)
        index_before=page.evaluate('window.__trainerTests.getSession().index')
        page.click('#endSessionBtn'); page.locator('#confirmOk').click(); page.wait_for_timeout(50)
        ok(page.locator('#resumeCard').is_visible(),'przerwana lekcja pokazuje kartę wznowienia',results)
        page.click('#resumeSessionBtn');
        ok(page.evaluate('window.__trainerTests.getSession().index')==index_before,'wznowienie zachowuje miejsce lekcji',results)
        for _ in range(100):
            if not page.evaluate('window.__trainerTests.getSession()'): break
            answer_current(page)
        ok(page.locator('#summary').is_visible(),'pierwsza lekcja kończy się podsumowaniem',results)
        ok(page.locator('#sumAccuracy').text_content().strip()=='100%','pełny poprawny przebieg daje 100%',results)
        page.evaluate("show('today')"); page.click('[data-nav="course"]')
        lesson2=page.locator('[data-course-lesson="a1-m01-l02"]')
        ok(lesson2.count()==1 and not lesson2.is_disabled(),'zaliczenie odblokowuje lekcję 2',results)
        page.close(); browser.close()
    failed=[name for name,value in results if not value]
    for name,value in results: print(('PASS ' if value else 'FAIL ')+name)
    print(f'Wynik UI: {len(results)-len(failed)}/{len(results)}')
    return 1 if failed else 0

if __name__=='__main__':
    code=main();os._exit(code)
