"""Genera los TTF estáticos que incrusta el PDF del presupuesto (src/scripts/presupuesto-pdf.js).

Parte de las fuentes variables (OFL 1.1) que el sitio ya trae: @fontsource-variable/sora e inter, subconjunto latin
(el mismo que publica Google Fonts). Fija el peso, pasa los dígitos a ancho tabular (columnas de importes alineadas)
y recorta a ASCII + latín-1 + puntuación común. jsPDF solo lee TTF estático: no sabe de fuentes variables ni de WOFF2.
Uso (desde la raíz del repo):  python tools/pdf-fonts.py      (requiere fonttools y brotli)
"""
import pathlib
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'node_modules/@fontsource-variable'
OUT = ROOT / 'src/assets/pdf-fonts'
UNICODES = [*range(0x20, 0x7F), *range(0xA0, 0x100), 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x2212, 0x20AC]
# (archivo, familia, estilo, peso, sufijo de los dígitos tabulares en esa fuente)
JOBS = [
    ('sora/files/sora-latin-wght-normal.woff2', 'Sora', 'Bold', 700, '.tnum'),
    ('sora/files/sora-latin-wght-normal.woff2', 'Sora', 'ExtraBold', 800, '.tnum'),
    ('inter/files/inter-latin-wght-normal.woff2', 'Inter', 'Regular', 400, '.tf'),
    ('inter/files/inter-latin-wght-normal.woff2', 'Inter', 'SemiBold', 600, '.tf'),
]

OUT.mkdir(parents=True, exist_ok=True)
for src, family, style, wght, tab in JOBS:
    font = instancer.instantiateVariableFont(TTFont(SRC / src), {'wght': wght}, inplace=False)
    glyphs = set(font.getGlyphOrder())
    for table in font['cmap'].tables:   # 0-9 → variante tabular (sin GSUB: jsPDF no aplica rasgos OpenType)
        for cp, name in list(table.cmap.items()):
            if 0x30 <= cp <= 0x39 and name + tab in glyphs:
                table.cmap[cp] = name + tab
    names = font['name']
    ps = f'{family}-{style}'
    for rec in list(names.names):   # nombres coherentes con el peso fijado (ID 1 familia, 2 estilo, 4 completo, 6 PostScript)
        if rec.nameID in (1, 16):
            rec.string = family
        elif rec.nameID in (2, 17):
            rec.string = style
        elif rec.nameID == 4:
            rec.string = f'{family} {style}'
        elif rec.nameID == 6:
            rec.string = ps
    font.flavor = None
    opts = subset.Options()
    opts.layout_features = []
    opts.hinting = False
    opts.notdef_outline = True
    opts.glyph_names = True
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    opts.drop_tables += ['GDEF', 'GPOS', 'GSUB', 'STAT', 'gasp', 'prep', 'HVAR', 'MVAR', 'avar', 'fvar', 'gvar', 'cvar']
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)
    path = OUT / f'{ps}.ttf'
    font.save(path)
    print(f'{path.name}: {path.stat().st_size / 1024:.1f} KB, {len(font.getGlyphOrder())} glifos')
