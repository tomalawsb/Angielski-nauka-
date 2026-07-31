#!/usr/bin/env python3
"""Pakiet 8: dostępność, prywatność, wersjonowanie, kopia i warianty językowe."""
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
    def script(match):
        text=(ROOT/match.group(1)).read_text(encoding='utf-8').replace('localStorage','TEST_LOCAL_STORAGE').replace('sessionStorage','TEST_SESSION_STORAGE')
        return '<script>'+text+'</script>'
    return re.sub(r'<script src="([^"]+)"(?: defer)?></script>',script,html)

def main():
    results=[]
    def ok(value,name): results.append((name,bool(value)))
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':390,'height':844})
        errors=[]; page.on('pageerror',lambda error:errors.append(str(error)))
        page.set_content(inline_app(),wait_until='load');page.wait_for_timeout(250)
        ok(page.locator('.skip-link').count()==1,'jest odsyłacz pomijający nawigację')
        ok(page.locator('#mainContent').get_attribute('tabindex')=='-1','główna treść może otrzymać fokus')
        ok(bool(page.locator('#onboardingDialog').get_attribute('aria-labelledby') or page.locator('#onboardingDialog').get_attribute('aria-label')),'onboarding ma nazwę dostępną')
        for _ in range(5): page.click('#onboardingNext')
        page.evaluate("show('settings')")
        ok(page.locator('.nav[data-nav="more"]').get_attribute('aria-current')=='page','aktywna zakładka ma aria-current')
        ok(page.locator('#importFileInput').get_attribute('accept')=='application/json,.json','import ogranicza wybór do JSON')
        page.click('#prepareExportBtn')
        exported=page.locator('#dataBox').input_value()
        ok('"version": "6.6.0"' in exported,'kopia zawiera wersję programu')
        ok('"contentVersion": "a1-a2-2026.07-r1"' in exported,'kopia zawiera wersję treści')
        ok(page.locator('#dataStatus').get_attribute('aria-live')=='polite','status importu jest ogłaszany czytnikowi')
        ok(page.evaluate("window.__trainerTests.answerScore('My favourite colour is grey.','My favorite color is gray.').status")=='correct','warianty brytyjski i amerykański są równoważne')
        migrated=page.evaluate("window.__trainerTests.validateImportedState(JSON.stringify({version:'6.5.0'}))")
        ok(migrated['version']=='6.6.0' and migrated['contentVersion']=='a1-a2-2026.07-r1','import 6.5.0 migruje do wersji finalnej')
        page.evaluate("show('info')")
        text=page.locator('#infoScreen').inner_text()
        ok('nie zawiera reklam ani analityki' in text,'informacja o prywatności opisuje brak analityki')
        ok('nie zapisuje plików dźwiękowych' in text,'informacja wyjaśnia użycie mikrofonu')
        ok('po zablokowaniu ekranu' in text,'informacja opisuje ograniczenia trybu samochodowego')
        page.evaluate("show('help')")
        ok('colour/color' in page.locator('#helpScreen').inner_text(),'pomoc opisuje warianty pisowni')
        ok(not errors,'brak błędów JavaScript')
        browser.close()
    failed=[name for name,value in results if not value]
    for name,value in results: print(('PASS ' if value else 'FAIL ')+name)
    print(f'Wynik końcowego UI QA: {len(results)-len(failed)}/{len(results)}')
    return 1 if failed else 0

if __name__=='__main__':
    code=main();os._exit(code)
