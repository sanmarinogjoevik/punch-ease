

## Problem

PDF-exporten i rapporter (timelista, vaktlista, temperatur) genererar 3 sidor eftersom:
1. **Marginaler är för stora** (`margin: 1` = 1 tum per sida)
2. **Ingen sidbrytningskontroll** – html2pdf saknar `pagebreak`-konfiguration
3. **Innehållet skalas inte** – tabellen med ~30 rader (en hel månad) passar inte på en A4-sida med nuvarande fontstorlek
4. **Onödiga UI-element** (Card-ramar, shadows) tar plats i PDF:en

## Plan

### 1. Förbättra PDF-konfigurationen i alla tre exportfunktioner

Uppdatera `exportTimelistToPDF`, `exportShiftListToPDF` och `exportTemperatureToPDF` med:
- Mindre marginaler (`margin: [5, 5, 5, 5]` i mm)
- `pagebreak: { mode: 'avoid-all' }` för att undvika att tabellrader bryts
- A4-format istället för letter
- Bättre html2canvas-inställningar (`scale: 1.5`, `windowWidth: 800`) för att skala ner innehållet

### 2. Lägg till PDF-specifik styling

Lägg till en CSS-klass på `#timelist-content` (och de andra content-divarna) som gör texten mer kompakt vid PDF-generering:
- Mindre fontstorlek i tabellen
- Mindre padding i celler  
- Dölj action-knappar (Edit/Delete) i PDF-kontexten genom att klona elementet och ta bort action-kolumnen innan export

### 3. Alternativ approach: generera PDF-HTML direkt

Istället för att fånga live-DOM:en, bygg en separat kompakt HTML-sträng optimerad för en A4-sida med:
- Mindre typsnitt (10px)
- Kompakt tabell utan extra padding
- Ingen Card-wrapper

Den enklaste och mest robusta lösningen är att uppdatera html2pdf-optionerna och lägga till en temporär CSS-klass under PDF-generering som krymper innehållet.

### Filer som ändras
- `src/pages/Reports.tsx` – Alla tre PDF-exportfunktioner + temporär kompakt styling

