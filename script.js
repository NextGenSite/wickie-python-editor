        // ─── Python Autocomplete ──────────────────────────────────────────────────────

        const PY_WORDS = [
            // Keywords
            'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
            'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
            'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
            'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
            // Builtins
            'abs', 'all', 'any', 'bin', 'bool', 'breakpoint', 'bytearray', 'bytes',
            'callable', 'chr', 'classmethod', 'compile', 'complex', 'delattr', 'dict',
            'dir', 'divmod', 'enumerate', 'eval', 'exec', 'filter', 'float', 'format',
            'frozenset', 'getattr', 'globals', 'hasattr', 'hash', 'help', 'hex', 'id',
            'input', 'int', 'isinstance', 'issubclass', 'iter', 'len', 'list', 'locals',
            'map', 'max', 'memoryview', 'min', 'next', 'object', 'oct', 'open', 'ord',
            'pow', 'print', 'property', 'range', 'repr', 'reversed', 'round', 'set',
            'setattr', 'slice', 'sorted', 'staticmethod', 'str', 'sum', 'super',
            'tuple', 'type', 'vars', 'zip',
            // String-Methoden
            'append', 'extend', 'insert', 'remove', 'pop', 'clear', 'index', 'count',
            'sort', 'reverse', 'copy', 'update', 'keys', 'values', 'items', 'get',
            'split', 'join', 'strip', 'lstrip', 'rstrip', 'replace', 'find', 'rfind',
            'upper', 'lower', 'title', 'capitalize', 'startswith', 'endswith',
            'encode', 'decode', 'isdigit', 'isalpha', 'isalnum', 'isspace', 'zfill',
            // Module
            'math', 'random', 'os', 'sys', 'json', 'time', 'datetime', 're',
            'collections', 'itertools', 'functools', 'pathlib', 'io',
        ];

        function pythonHint(cm) {
            const cur = cm.getCursor();
            const line = cm.getLine(cur.line);
            let start = cur.ch;
            while (start > 0 && /\w/.test(line[start - 1])) start--;
            const word = line.slice(start, cur.ch);
            if (!word) return null;
            const matches = PY_WORDS.filter(w => w.startsWith(word) && w !== word);
            if (!matches.length) return null;
            return { list: matches, from: CodeMirror.Pos(cur.line, start), to: CodeMirror.Pos(cur.line, cur.ch) };
        }

        // ─── CodeMirror Setup ─────────────────────────────────────────────────────────

        const editor = CodeMirror.fromTextArea(document.getElementById('editorArea'), {
            mode: 'python',
            theme: 'dracula',
            lineNumbers: true,
            matchBrackets: true,
            autoCloseBrackets: true,
            indentUnit: 4,
            tabSize: 4,
            indentWithTabs: false,
            lineWrapping: false,
            extraKeys: {
                'Ctrl-Enter': runCode,
                'Cmd-Enter': runCode,
                'Ctrl-Space': cm => CodeMirror.showHint(cm, pythonHint, { completeSingle: false }),
                'Tab': cm => cm.replaceSelection('    ')
            }
        });

        // Automatisch beim Tippen von Buchstaben
        editor.on('inputRead', (cm, change) => {
            if (/\w/.test(change.text[0])) {
                CodeMirror.showHint(cm, pythonHint, { completeSingle: false });
            }
        });

        editor.setValue(`# Willkommen im Python Online Editor!

print("Hallo, Welt!")
print()

for i in range(1, 8):
    sterne = "★" * i
    print(f"  {sterne}")
`);

        // ─── Output helpers ───────────────────────────────────────────────────────────

        const outputEl = document.getElementById('output');

        function clearOutput() {
            outputEl.innerHTML = '';
            hideTurtleCanvas();
        }

        function hideTurtleCanvas() {
            document.getElementById('turtleCanvas')?.classList.remove('active');
            const title = document.getElementById('outputPaneTitle');
            if (title) title.textContent = '⬛ Ausgabe';
        }

        function appendLine(text, cls) {
            const span = document.createElement('span');
            span.className = cls;
            span.textContent = text;
            outputEl.appendChild(span);
            outputEl.scrollTop = outputEl.scrollHeight;
        }

        // ─── Wickie Fehler-Analyse ─────────────────────────────────────────────────────

        let _errBuf = '';

        // ── Fehlerzeile im Editor markieren ──────────────────────────────────────────
        let _errorLineHandle = null;
        function highlightErrorLine(lineNum) {
            if (_errorLineHandle !== null) {
                editor.removeLineClass(_errorLineHandle, 'background', 'cm-error-line');
                editor.removeLineClass(_errorLineHandle, 'gutter', 'cm-error-line-gutter');
                _errorLineHandle = null;
            }
            if (!lineNum) return;
            const ln = parseInt(lineNum, 10) - 1;
            if (ln >= 0 && ln < editor.lineCount()) {
                editor.addLineClass(ln, 'background', 'cm-error-line');
                editor.addLineClass(ln, 'gutter', 'cm-error-line-gutter');
                editor.scrollIntoView({ line: ln, ch: 0 }, 80);
                _errorLineHandle = ln;
            }
        }

        function analyzePythonError(tb) {
            const t = tb.toLowerCase();
            // Bevorzuge Zeilennummer aus User-Code (<string>/<exec>)
            const userLineMatch = tb.match(/<(?:string|exec)>["']?,?\s*line (\d+)/i);
            const allLineMatches = [...tb.matchAll(/line (\d+)/gi)];
            const lineNum = userLineMatch ? userLineMatch[1]
                : allLineMatches.length ? allLineMatches[allLineMatches.length - 1][1]
                    : null;
            const ln = lineNum ? ` (Zeile ${lineNum})` : '';
            highlightErrorLine(lineNum);

            // ── SyntaxError ──
            if (t.includes('syntaxerror')) {
                if (t.includes('expected ":"') || t.includes("expected ':'"))
                    return ['✏️ SyntaxFehler' + ln, 'Vergisst du einen Doppelpunkt <code>:</code>?', 'Nach <code>if</code>, <code>for</code>, <code>while</code>, <code>def</code> und <code>class</code> muss immer ein <code>:</code> stehen.'];
                if (t.includes("'(' was never closed") || t.includes("was never closed"))
                    return ['✏️ SyntaxFehler' + ln, 'Eine Klammer wurde nie geschlossen!', 'Prüfe ob jede öffnende Klammer <code>(</code> auch eine schließende <code>)</code> hat.'];
                if (t.includes('eol while scanning string') || t.includes('unterminated string'))
                    return ['✏️ SyntaxFehler' + ln, 'Ein Anführungszeichen wurde nicht geschlossen!', 'Jedes <code>"</code> braucht ein schließendes <code>"</code>. Prüfe deine Texte (Strings).'];
                if (t.includes('invalid syntax') && (t.includes('print ') || t.includes("print'")))
                    return ['✏️ SyntaxFehler' + ln, 'Vergisst du die Klammern bei <code>print</code>?', 'In Python 3 muss es <code>print("Text")</code> heißen — mit Klammern!'];
                if (t.includes('indent'))
                    return ['📐 EinrückungsFehler' + ln, 'Deine Einrückung stimmt nicht!', 'Benutze immer <b>4 Leerzeichen</b> pro Ebene. Mische keine Tabs und Leerzeichen.'];
                if (t.includes('invalid syntax'))
                    return ['✏️ SyntaxFehler' + ln, 'Python versteht diese Zeile nicht.', 'Häufige Ursachen: fehlendes <code>:</code>, falsche Klammern <code>()</code>, oder Tippfehler im Befehlsnamen.'];
                return ['✏️ SyntaxFehler' + ln, 'Dein Code hat einen Schreibfehler.', 'Prüfe auf fehlende Klammern <code>()</code>, Anführungszeichen <code>""</code> oder Doppelpunkte <code>:</code>.'];
            }

            // ── IndentationError ──
            if (t.includes('indentationerror')) {
                if (t.includes('unexpected indent'))
                    return ['📐 EinrückungsFehler' + ln, 'Diese Zeile ist zu weit eingerückt!', 'Entferne überflüssige Leerzeichen am Zeilenanfang.'];
                if (t.includes('expected an indented block'))
                    return ['📐 EinrückungsFehler' + ln, 'Nach dem Doppelpunkt fehlt eingerückter Code!', 'Der Block nach <code>if/for/def/...</code> muss mit 4 Leerzeichen eingerückt sein.'];
                return ['📐 EinrückungsFehler' + ln, 'Die Einrückung stimmt nicht!', 'Benutze immer <b>4 Leerzeichen</b> pro Ebene und mische keine Tabs mit Leerzeichen.'];
            }

            // ── NameError ──
            if (t.includes('nameerror')) {
                const m = tb.match(/name '([^']+)' is not defined/);
                const v = m ? `<code>${m[1]}</code>` : 'eine Variable';
                const varName = m ? m[1] : 'variable';
                const hint = varName === varName.toUpperCase()
                    ? `Konstanten in Python sind normale Variablen. Weise ihr einen Wert zu: <code>${varName} = ...</code>`
                    : `Weise ihr zuerst einen Wert zu, z.B.: <code>${varName} = ...</code><br>Prüfe auch die Schreibweise — Python unterscheidet Groß-/Kleinbuchstaben!`;
                return ['❓ NameFehler' + ln, `${v} wurde noch nicht definiert.`, hint];
            }

            // ── TypeError ──
            if (t.includes('typeerror')) {
                if (t.includes('can only concatenate str') || t.includes('must be str'))
                    return ['🔢 TypeFehler' + ln, 'Du verbindest einen Text mit einer Zahl!', 'Wandle Zahlen in Text um: <code>str(zahl)</code><br>Oder benutze f-Strings: <code>f"Zahl: {n}"</code>'];
                if (t.includes('unsupported operand'))
                    return ['🔢 TypeFehler' + ln, 'Diese Rechenoperation funktioniert mit diesem Datentyp nicht!', 'Prüfe ob deine Variablen Zahlen (<code>int/float</code>) oder Texte (<code>str</code>) sind.'];
                if (t.includes('object is not subscriptable'))
                    return ['🔢 TypeFehler' + ln, 'Auf dieses Objekt kann nicht mit <code>[]</code> zugegriffen werden!', 'Nur Listen, Tupel, Strings und Dictionaries unterstützen <code>[index]</code>.'];
                if (t.includes('object is not iterable'))
                    return ['🔢 TypeFehler' + ln, 'Dieses Objekt kann nicht in einer Schleife durchlaufen werden!', 'Nur Listen, Strings, Tupel usw. sind iterierbar. Nutze z.B. <code>range(n)</code> für Zahlen.'];
                if (t.includes('takes') && t.includes('argument'))
                    return ['🔢 TypeFehler' + ln, 'Falsche Anzahl an Argumenten für diese Funktion!', 'Prüfe in der Funktionsdefinition (<code>def</code>) wie viele Parameter erwartet werden.'];
                if (t.includes("'nonetype'") || t.includes('none'))
                    return ['🔢 TypeFehler' + ln, 'Du verwendest einen Wert der <code>None</code> ist!', 'Eine Funktion gibt <code>None</code> zurück wenn kein <code>return</code> angegeben ist.'];
                return ['🔢 TypeFehler' + ln, 'Falscher Datentyp.', 'Prüfe ob du Zahlen und Texte richtig umwandelst: <code>int()</code>, <code>str()</code>, <code>float()</code>'];
            }

            // ── ValueError ──
            if (t.includes('valueerror')) {
                if (t.includes('invalid literal'))
                    return ['🔄 WertFehler' + ln, 'Kein gültiger Zahlenwert!', 'Du versuchst einen Text in eine Zahl umzuwandeln, der keine Zahl enthält.<br>Prüfe den Wert vor <code>int()</code> oder <code>float()</code>.'];
                if (t.includes('too many values to unpack'))
                    return ['🔄 WertFehler' + ln, 'Zu viele Werte beim Entpacken!', 'Du hast mehr Werte als Variablen auf der linken Seite: <code>a, b = [1, 2, 3]</code> → Fehler.'];
                if (t.includes('not enough values to unpack'))
                    return ['🔄 WertFehler' + ln, 'Zu wenige Werte beim Entpacken!', 'Die Anzahl der Variablen links passt nicht zu den Werten rechts.'];
                return ['🔄 WertFehler' + ln, 'Ein falscher Wert wurde übergeben.', 'Prüfe deine Eingaben auf korrekte Werte und den erwarteten Bereich.'];
            }

            // ── ZeroDivisionError ──
            if (t.includes('zerodivisionerror'))
                return ['➗ Division durch Null' + ln, 'Du teilst durch 0 – das ist nicht erlaubt!', 'Prüfe deinen Teiler vor der Division: <code>if teiler != 0: ...</code>'];

            // ── IndexError ──
            if (t.includes('indexerror')) {
                if (t.includes('list'))
                    return ['📋 IndexFehler' + ln, 'Index außerhalb der Liste!', 'Listen starten bei <code>0</code>. Eine Liste mit 3 Elementen hat nur die Indizes <code>0, 1, 2</code>. Benutze <code>len(liste)</code> um die Länge zu prüfen.'];
                if (t.includes('string') || t.includes('str'))
                    return ['📋 IndexFehler' + ln, 'Index außerhalb des Textes!', 'Strings funktionieren wie Listen: <code>text[0]</code> ist der erste Buchstabe.'];
                return ['📋 IndexFehler' + ln, 'Kein Element an dieser Stelle!', 'Der Index ist zu groß. Prüfe die Länge mit <code>len()</code>.'];
            }

            // ── KeyError ──
            if (t.includes('keyerror')) {
                const m = tb.match(/KeyError: (.+)/);
                return ['🗝️ KeyFehler' + ln, `Schlüssel ${m ? `<code>${m[1]}</code>` : ''} existiert nicht im Dictionary!`, 'Benutze <code>dict.get(schlüssel)</code> für sichere Abfragen, oder prüfe mit <code>if schlüssel in dict:</code>'];
            }

            // ── AttributeError ──
            if (t.includes('attributeerror')) {
                const m = tb.match(/has no attribute '([^']+)'/);
                const attr = m ? `<code>.${m[1]}()</code>` : 'diese Methode';
                return ['🔧 AttributFehler' + ln, `${attr} existiert nicht für diesen Datentyp!`, 'Prüfe den Datentyp mit <code>type(variable)</code> und schaue nach welche Methoden verfügbar sind.'];
            }

            // ── ImportError ──
            if (t.includes('modulenotfounderror') || t.includes('importerror')) {
                const m = tb.match(/No module named '([^']+)'/);
                return ['📦 ImportFehler', `Modul ${m ? `<code>${m[1]}</code>` : ''} nicht gefunden.`, 'In diesem Browser-Editor sind verfügbar: <code>math</code>, <code>random</code>, <code>json</code>, <code>re</code>, <code>datetime</code>, <code>collections</code>.'];
            }

            // ── RecursionError ──
            if (t.includes('recursionerror'))
                return ['🔁 RekursionsFehler' + ln, 'Endlosrekursion – die Funktion ruft sich zu oft auf!', 'Stelle sicher dass deine Funktion einen Basisfall hat: <code>if n == 0: return ...</code>'];

            // ── OverflowError ──
            if (t.includes('overflowerror'))
                return ['💥 ÜberlaufFehler' + ln, 'Die Zahl ist zu groß für Python!', 'Versuche kleinere Zahlen oder nutze <code>math.inf</code> für sehr große Werte.'];

            // ── StopIteration ──
            if (t.includes('stopiteration'))
                return ['🔚 StopIteration' + ln, 'Der Iterator hat keine weiteren Elemente!', 'Benutze <code>for</code>-Schleifen statt <code>next()</code> um sicher über Elemente zu iterieren.'];

            // ── FileNotFoundError ──
            if (t.includes('filenotfounderror'))
                return ['📁 DateiFehler' + ln, 'Datei nicht gefunden!', 'Im Browser-Editor ist kein Dateisystem verfügbar. Speichere Daten stattdessen in Variablen oder Listen.'];

            // ── PermissionError ──
            if (t.includes('permissionerror'))
                return ['🔒 BerechtigungsFehler' + ln, 'Keine Berechtigung für diese Operation!', 'Im Browser-Editor sind Datei-Operationen nicht erlaubt.'];

            // ── TimeoutError / KeyboardInterrupt ──
            if (t.includes('timeouterror') || t.includes('keyboardinterrupt'))
                return ['⏱️ Abbruch' + ln, 'Das Programm wurde unterbrochen!', 'Dein Code hat möglicherweise eine Endlosschleife. Prüfe die Abbruchbedingung in <code>while</code>-Schleifen.'];

            // ── AssertionError ──
            if (t.includes('assertionerror'))
                return ['❗ AssertionFehler' + ln, 'Eine Überprüfung (<code>assert</code>) ist fehlgeschlagen!', 'Die Bedingung nach <code>assert</code> war nicht erfüllt. Prüfe deine Logik.'];

            // ── NotImplementedError ──
            if (t.includes('notimplementederror'))
                return ['🚧 Nicht implementiert' + ln, 'Diese Methode wurde noch nicht umgesetzt!', 'Du rufst eine Funktion auf, die noch keinen Code enthält (<code>pass</code> oder <code>raise NotImplementedError</code>).'];

            // ── UnboundLocalError ──
            if (t.includes('unboundlocalerror')) {
                const m = tb.match(/local variable '([^']+)' referenced before assignment/);
                const v = m ? `<code>${m[1]}</code>` : 'eine lokale Variable';
                return ['❓ VariablenFehler' + ln, `${v} wurde vor dem Zuweisen benutzt!`, 'Weise der Variable zuerst einen Wert zu, bevor du sie verwendest. Oder nutze <code>global variable</code>.'];
            }

            return ['⚠️ Fehler beim Ausführen', 'Schau dir die rote Fehlermeldung genau an.', 'Suche die markierte Zeile und prüfe Schreibweise, Klammern und Doppelpunkte.'];
        }

        function showWickieTip(tb) {
            const [title, msg, hint] = analyzePythonError(tb);
            const bubble = document.getElementById('wickieBubble');
            document.getElementById('wickieTipText').innerHTML =
                `<strong>${title}</strong>${msg}<div class="tip-hint">${hint}</div>`;
            bubble.classList.remove('show');
            void bubble.offsetWidth; // reflow → restart animation
            bubble.classList.add('show');
            clearTimeout(bubble._timer);
            bubble._timer = setTimeout(() => bubble.classList.remove('show'), 14000);
        }

        const WICKIE_SUCCESS = [
            ['🎉 Super gemacht!', 'Dein Code hat funktioniert!', 'Weiter so — du lernst schnell!'],
            ['⭐ Klasse!', 'Alles richtig!', 'Du hast das Programm erfolgreich ausgeführt. Sehr gut!'],
            ['🏆 Toll!', 'Kein einziger Fehler!', 'Das war perfekt. Kannst du den Code noch weiter verbessern?'],
            ['💪 Gut gemacht!', 'Dein Programm läuft!', 'Jetzt kannst du es gerne mit anderen Werten ausprobieren.'],
            ['🌟 Wunderbar!', 'Das hat geklappt!', 'Ich bin stolz auf dich — weiter so!'],
            ['🚀 Fantastisch!', 'Dein Code ist fehlerfrei!', 'Du wirst ein echter Python-Profi!'],
            ['🦄 Unglaublich!', 'Dein Programm läuft perfekt!', 'Hast du schon versucht, es effizienter zu machen?'],
            ['🌈 Hervorragend!', 'Alles hat geklappt!', 'Python macht Spaß, oder? Probiere etwas Neues aus!'],
            ['🎯 Treffer!', 'Genau so soll Code aussehen!', 'Du zeigst echtes Talent für Programmieren.'],
            ['🔥 Mega!', 'Dein Code brennt vor Qualität!', 'Mach weiter so – du bist auf dem richtigen Weg!'],
            ['🌺 Schön gemacht!', 'Fehlerfreier Code, das ist toll!', 'Versuche jetzt, den Code zu erweitern.'],
            ['⚡ Blitzschnell!', 'Dein Programm läuft ohne Probleme!', 'Kannst du die Ausgabe noch schöner gestalten?'],
            ['🎸 Rockstar!', 'Du programmierst wie ein Profi!', 'Zeig deinen Freunden, was du kannst!'],
            ['🧠 Clever!', 'Gut gedacht und gut gemacht!', 'Dein logisches Denken wird immer stärker.'],
            ['🦅 Stark!', 'Dein Code fliegt ohne Fehler!', 'Probiere jetzt eine eigene Funktion zu schreiben.'],
            ['🎪 Wow!', 'Das hat richtig gut funktioniert!', 'Du meisterst Python Schritt für Schritt.'],
            ['🏅 Medaillenreif!', 'Deine Lösung ist super!', 'Beim nächsten Mal vielleicht noch eleganter?'],
            ['🌊 Smooth!', 'Dein Code läuft wie Wasser!', 'Weiter üben macht den Meister!'],
            ['🎠 Perfekt!', 'Alles richtig gemacht!', 'Ich freue mich mit dir über diesen Erfolg!'],
            ['🦋 Wunderschön!', 'Dein Programm ist fehlerfrei!', 'Vielleicht kannst du es jetzt noch kommentieren?'],
            ['🌙 Großartig!', 'Du hast es geschafft!', 'Jede Zeile Code macht dich besser.'],
            ['🎆 Spitzenklasse!', 'Null Fehler — hundert Prozent!', 'Das ist echter Programmier-Erfolg!'],
            ['🐍 Python-Held!', 'Dein Code spricht Python fließend!', 'Schlangen mögen guten Code — und das hier ist sehr gut!'],
            ['🏰 Meisterhaft!', 'Kein Bug konnte dich stoppen!', 'Du bist auf dem Weg zum Python-Meister!'],
            ['🎓 Lernprofi!', 'Du wächst mit jedem Code!', 'Fehler morgen? Kein Problem — du weißt wie man sie löst!'],
            ['🦁 Mutig!', 'Du hast es probiert und es hat geklappt!', 'Mut beim Programmieren zahlt sich immer aus.'],
            ['🌻 Sonnig!', 'Dein Code macht gute Laune!', 'Teile dein Wissen — erkläre jemandem was du gemacht hast!'],
            ['🎋 Zen!', 'Ruhig, klar und korrekt — so mag ich Code!', 'Gut strukturierter Code ist halb gelöster Code.'],
            ['🚂 Volle Fahrt!', 'Dein Programm läuft ohne Unterbrechung!', 'Kannst du es jetzt mit mehr Daten testen?'],
            ['🌍 Weltklasse!', 'Das könnte auch ein echter Entwickler geschrieben haben!', 'Du machst Fortschritte, die sichtbar sind!'],
        ];

        function showWickieSuccess() {
            const [title, msg, hint] = WICKIE_SUCCESS[Math.floor(Math.random() * WICKIE_SUCCESS.length)];
            const bubble = document.getElementById('wickieBubble');
            document.getElementById('wickieTipText').innerHTML =
                `<strong style="color:#a6e3a1">${title}</strong>${msg}<div class="tip-hint">${hint}</div>`;
            bubble.classList.remove('show');
            void bubble.offsetWidth;
            bubble.classList.add('show');
            clearTimeout(bubble._timer);
            bubble._timer = setTimeout(() => bubble.classList.remove('show'), 8000);
        }

        document.getElementById('closeBubble').addEventListener('click', () => {
            document.getElementById('wickieBubble').classList.remove('show');
        });

        // Called from Python via js.pyWrite / js.pyErr
        window.pyWrite = text => {
            const span = document.createElement('span');
            span.className = 'out';
            span.textContent = text;
            outputEl.appendChild(span);
            outputEl.scrollTop = outputEl.scrollHeight;
        };

        window.pyErr = text => {
            _errBuf += text;
            const span = document.createElement('span');
            span.className = 'err';
            span.textContent = text;
            outputEl.appendChild(span);
            outputEl.scrollTop = outputEl.scrollHeight;
        };

        // ─── Pyodide ──────────────────────────────────────────────────────────────────

        let pyodide = null;

        async function initPyodide() {
            const statusEl = document.getElementById('status');
            const statusText = document.getElementById('status-text');
            try {
                pyodide = await loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
                });

                // Redirect stdout / stderr to our JS callbacks
                pyodide.runPython(`
import sys, builtins, js

class _Stream:
    encoding = 'utf-8'
    def __init__(self, cb): self._cb = cb
    def write(self, s):
        if s: self._cb(s)
    def flush(self): pass

sys.stdout = _Stream(js.pyWrite)
sys.stderr = _Stream(js.pyErr)

def _input(prompt=''):
    if prompt:
        sys.stdout.write(str(prompt))
    val = js.prompt(str(prompt) if prompt else 'Eingabe:')
    result = '' if val is None else str(val)
    sys.stdout.write(result + '\\n')
    return result

builtins.input = _input
`);

                // ── Turtle-Modul registrieren (Record & Replay) ──
                pyodide.runPython(`
import sys, math, types, json

class _TurtleCanvas:
    def __init__(self):
        self._speed = 6
        self._cmds = []
        self._reset_state()

    def _reset_state(self):
        self._x = 0.0; self._y = 0.0; self._angle = 0.0
        self._pen_down = True
        self._pen_color = 'black'; self._fill_color = 'black'
        self._pen_width = 1
        self._filling = False; self._fill_world = []
        self._cmds = []

    def _rec(self, *cmd):
        self._cmds.append(list(cmd))

    def _move(self, nx, ny):
        if self._pen_down:
            self._rec('L', self._x, self._y, nx, ny, self._pen_color, self._pen_width)
        if self._filling:
            self._fill_world.append([nx, ny])
        self._x = nx; self._y = ny

    def forward(self, d):
        a = math.radians(self._angle)
        self._move(self._x + d*math.cos(a), self._y + d*math.sin(a))

    def backward(self, d): self.forward(-d)
    def right(self, a): self._angle -= a
    def left(self, a): self._angle += a

    def goto(self, x, y=None):
        if y is None and hasattr(x,'__iter__'):
            it=iter(x); x=next(it); y=next(it)
        self._move(float(x), float(y))

    def setx(self, x): self.goto(x, self._y)
    def sety(self, y): self.goto(self._x, y)
    def setheading(self, a): self._angle = float(a)

    def home(self):
        save=self._pen_down; self._pen_down=False
        self.goto(0,0); self._pen_down=save; self._angle=0.0

    def penup(self): self._pen_down = False
    def pendown(self): self._pen_down = True

    def color(self, *a):
        if len(a)==1: self._pen_color=self._fill_color=a[0]
        elif len(a)>=2: self._pen_color=a[0]; self._fill_color=a[1]

    def pencolor(self, c=None):
        if c is not None: self._pen_color=c
        return self._pen_color

    def fillcolor(self, c=None):
        if c is not None: self._fill_color=c
        return self._fill_color

    def width(self, w=None):
        if w is not None: self._pen_width=w
        return self._pen_width

    def pensize(self, w=None): return self.width(w)

    def begin_fill(self):
        self._filling=True
        self._fill_world=[[self._x, self._y]]

    def end_fill(self):
        if self._filling and self._fill_world:
            self._rec('F', [list(p) for p in self._fill_world], self._fill_color)
        self._filling=False; self._fill_world=[]

    def circle(self, r, extent=360, steps=None):
        if steps is None: steps=max(6,int(abs(r)*abs(extent)*math.pi/180/2))
        sa=extent/steps
        sd=2*math.pi*abs(r)*(abs(extent)/360)/steps
        sign=1 if r>0 else -1
        for _ in range(steps):
            self.forward(sd); self.left(sa*sign)

    def dot(self, size=None, color=None):
        if size is None: size=max(self._pen_width+4, 2*self._pen_width)
        self._rec('D', self._x, self._y, size/2, color or self._pen_color)

    def write(self, text, move=False, align='left', font=('Arial',12,'normal')):
        fam=font[0] if len(font)>0 else 'Arial'
        sz=int(font[1]) if len(font)>1 else 12
        st2=font[2] if len(font)>2 else 'normal'
        self._rec('T', self._x, self._y, str(text), f'{st2} {sz}px {fam}', self._pen_color, align)

    def stamp(self): self._rec('D', self._x, self._y, 5, self._pen_color)
    def clear(self): self._rec('C')
    def reset(self): self._reset_state()

    def speed(self, s=None):
        if s is not None: self._speed=int(s)
        return self._speed

    def hideturtle(self): pass
    def showturtle(self): pass
    def isdown(self): return self._pen_down
    def position(self): return (self._x, self._y)
    def xcor(self): return self._x
    def ycor(self): return self._y
    def heading(self): return self._angle

    def _cmds_json(self):
        return json.dumps(self._cmds)

    fd=forward; bk=backward; rt=right; lt=left
    pu=penup; pd=pendown; seth=setheading; pos=position
    up=penup; down=pendown; ht=hideturtle; st=showturtle

_t = _TurtleCanvas()
_bg_color = 'white'

def forward(d): _t.forward(d)
def backward(d): _t.backward(d)
def right(a): _t.right(a)
def left(a): _t.left(a)
def penup(): _t.penup()
def pendown(): _t.pendown()
def goto(x, y=None): _t.goto(x, y)
def setpos(x, y=None): _t.goto(x, y)
def setposition(x, y=None): _t.goto(x, y)
def setx(x): _t.setx(x)
def sety(y): _t.sety(y)
def setheading(a): _t.setheading(a)
def home(): _t.home()
def color(*a): _t.color(*a)
def pencolor(c=None): return _t.pencolor(c)
def fillcolor(c=None): return _t.fillcolor(c)
def width(w=None): return _t.width(w)
def pensize(w=None): return _t.pensize(w)
def begin_fill(): _t.begin_fill()
def end_fill(): _t.end_fill()
def circle(r, extent=360, steps=None): _t.circle(r, extent, steps)
def dot(size=None, color=None): _t.dot(size, color)
def write(text, move=False, align='left', font=('Arial',12,'normal')): _t.write(text,move,align,font)
def stamp(): _t.stamp()
def clear(): _t.clear()
def reset(): _t.reset()
def hideturtle(): pass
def showturtle(): pass
def speed(s=None): return _t.speed(s)
def tracer(*a, **kw): pass
def update(): pass
def done(): pass
def mainloop(): pass
def title(t=None): pass
def setup(*a, **kw): pass
def Screen(): return None
def Turtle(): return _t
def bgcolor(c=None):
    global _bg_color
    if c is not None: _bg_color=c; _t._rec('BG', c)
    return _bg_color
def isdown(): return _t.isdown()
def position(): return _t.position()
def xcor(): return _t.xcor()
def ycor(): return _t.ycor()
def heading(): return _t.heading()

fd=forward; bk=backward; rt=right; lt=left
pu=penup; pd=pendown; ht=hideturtle; st=showturtle
seth=setheading; pos=position; up=penup; down=pendown

_turtle_mod = types.ModuleType('turtle')
for _k,_v in list(vars().items()):
    if not _k.startswith('__'): setattr(_turtle_mod, _k, _v)
sys.modules['turtle'] = _turtle_mod
`);

                statusText.textContent = 'Python bereit';
                statusEl.className = 'ready';
                document.getElementById('runBtn').disabled = false;

                clearOutput();
                appendLine('✓ Python ist bereit! \n', 'ok');
            } catch (err) {
                statusText.textContent = 'Ladefehler';
                statusEl.className = 'error';
                clearOutput();
                appendLine('Fehler beim Laden von Python:\n' + err.message, 'err');
            }
        }

        // ─── Run Code ─────────────────────────────────────────────────────────────────

        let _successCount = 0;
        const _seenCodes = new Set();
        let _confettiActive = false;

        const MOTIVATIONS = [
            '🚀 Fantastisch! Du wirst immer besser!',
            '🌟 Wow, das war perfekt! Weiter so!',
            '🎯 Treffer! Du hast es geschafft!',
            '💪 Super stark! Python liegt dir im Blut!',
            '🏆 Champion! 5 erfolgreiche Programme!',
            '✨ Brillant! Du machst das großartig!',
            '🎉 Yesss! Du bist ein Python-Profi!',
            '🔥 Heiß! Dein Code läuft wie geschmiert!',
            '🌈 Wunderschön! Fehlerfreier Code!',
            '⚡ Blitzschnell gelernt! Respekt!',
            '🦸 Python-Held des Tages! Weiter so!',
            '🎸 Rockstar-Code! Einfach klasse!',
            '🧠 Mega clever! Du denkst wie ein Programmierer!',
            '🌍 Die Welt der Programmierung gehört dir!',
            '💡 Brilliant! Dein Gehirn arbeitet auf Hochtouren!',
            '🎓 Lernkönig! So macht Programmieren Spaß!',
            '🐍 Python liebt dich! Und du liebst Python!',
            '🏅 Medaille verdient! Toll gemacht!',
            '🎊 Party-Zeit! Dein Code funktioniert!',
            '🌠 Stern der Woche! Einfach spitze!',
            '💎 Diamant-Code! Makellos und perfekt!',
            '🚂 Volldampf voraus! Du stoppst nicht!',
            '🦁 Mutig und stark! Kein Bug kann dich aufhalten!',
            '🎯 Volltreffer! Dein Code trifft ins Schwarze!',
            '🌺 Blühend talentiert! Weiter blühen!',
            '🤩 Ich bin begeistert! Du auch?',
            '🏄 Du surfst auf der Python-Welle!',
            '🎮 Level Up! Du wirst stärker!',
            '🍀 Viel Glück brauchst du nicht – du bist einfach gut!',
            '🦅 Flieger! Dein Code hebt ab!',
            '🌻 Sonnenschein! Dein Code erhellt alles!',
            '🎵 Musik in meinen Ohren – fehlerfreier Code!',
            '🏋️ Stark wie ein Programmierer-Profi!',
            '🌊 Welle für Welle – du wirst besser!',
            '🦊 Schlau wie ein Fuchs! Toller Code!',
            '🎨 Kunstwerk! Dein Code ist elegant!',
            '🚁 Abgehoben! Du erreichst neue Höhen!',
            '🌋 Explosiv gut! Unaufhaltbar!',
            '🦋 Verwandlung komplett – vom Anfänger zum Profi!',
            '🎪 Zirkus der Erfolge! Du bist der Star!',
            '🏰 König der Schleifen und Funktionen!',
            '🌙 Selbst nachts läuft dein Code perfekt!',
            '🎁 Ein Geschenk für Python: dein Talent!',
            '🦄 Einzigartig! Dein Coding-Stil ist besonders!',
            '🔮 Zauberer des Codes! Alles klappt!',
            '🐬 Spielend leicht! Du machst es toll!',
            '🌴 Entspannt und erfolgreich – das ist dein Stil!',
            '🏹 Pfeil ins Ziel! Präziser Code!',
            '🎠 Karussell des Erfolgs dreht sich für dich!',
            '🌟 50 Mal Erfolg – du bist eine Legende!',
        ];

        function launchConfetti(msg) {
            const end = Date.now() + 5000;
            const colors = ['#89b4fa','#a6e3a1','#cba6f7','#f9e2af','#f38ba8','#94e2d5'];
            (function frame() {
                confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors });
                confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors });
                if (Date.now() < end) requestAnimationFrame(frame);
            })();

            // Motivationsnachricht anzeigen
            const toast = document.createElement('div');
            toast.textContent = msg;
            Object.assign(toast.style, {
                position: 'fixed', top: '90px', left: '50%', transform: 'translateX(-50%) scale(0.8)',
                background: 'linear-gradient(135deg,#89b4fa,#cba6f7)',
                color: '#1e1e2e', fontWeight: '800', fontSize: '1.6rem',
                padding: '22px 40px', borderRadius: '20px',
                boxShadow: '0 12px 48px rgba(137,180,250,0.6)',
                zIndex: 99999, opacity: '0',
                transition: 'opacity 0.4s, transform 0.4s',
                textAlign: 'center', maxWidth: '85vw', lineHeight: '1.4',
            });
            document.body.appendChild(toast);
            requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(-50%) scale(1)';
            });
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) scale(0.8)';
                setTimeout(() => { toast.remove(); _confettiActive = false; }, 400);
            }, 4600);
        }

        // ─── Turtle Canvas Helpers ────────────────────────────────────────────────────

        let _turtleAbort = false;

        function prepareTurtleCanvas() {
            const canvas = document.getElementById('turtleCanvas');
            const pane = canvas.parentElement;
            const w = pane.clientWidth || 500;
            canvas.width = w;
            canvas.height = 380;
            canvas.classList.add('active');
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, 380);
            document.getElementById('outputPaneTitle').textContent = '🐢 Turtle + Ausgabe';
            pyodide.runPython('import sys; sys.modules["turtle"]._t._reset_state()');
        }

        // speed 1 = 120ms/Schritt, speed 10 = 5ms/Schritt, speed 0 = sofort
        function _turtleDelay(s) {
            if (!s || s === 0) return 0;
            const ms = [0, 120, 80, 55, 35, 22, 14, 9, 6, 3, 1];
            return ms[Math.min(10, Math.max(1, Math.round(s)))] ?? 14;
        }

        async function animateTurtle(canvas, cmds, delay) {
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            const tc = (x, y) => [w/2 + x, h/2 - y];

            for (const cmd of cmds) {
                if (_turtleAbort) return;
                const t = cmd[0];

                if (t === 'L') {
                    const [,x1,y1,x2,y2,color,lw] = cmd;
                    const [cx1,cy1] = tc(x1,y1), [cx2,cy2] = tc(x2,y2);
                    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = lw;
                    ctx.moveTo(cx1,cy1); ctx.lineTo(cx2,cy2); ctx.stroke();

                } else if (t === 'D') {
                    const [,x,y,r,color] = cmd;
                    const [cx,cy] = tc(x,y);
                    ctx.beginPath(); ctx.arc(cx,cy,r,0,2*Math.PI);
                    ctx.fillStyle = color; ctx.fill();

                } else if (t === 'F') {
                    const [,pts,color] = cmd;
                    if (!pts.length) continue;
                    const [fx,fy] = tc(pts[0][0],pts[0][1]);
                    ctx.beginPath(); ctx.moveTo(fx,fy);
                    for (let i=1; i<pts.length; i++) {
                        const [px,py] = tc(pts[i][0],pts[i][1]);
                        ctx.lineTo(px,py);
                    }
                    ctx.closePath(); ctx.fillStyle = color; ctx.fill();

                } else if (t === 'T') {
                    const [,x,y,text,font,color,align] = cmd;
                    const [cx,cy] = tc(x,y);
                    ctx.font = font; ctx.fillStyle = color;
                    ctx.textAlign = align || 'left';
                    ctx.fillText(text, cx, cy);

                } else if (t === 'C') {
                    ctx.clearRect(0,0,w,h);
                    ctx.fillStyle = 'white'; ctx.fillRect(0,0,w,h);

                } else if (t === 'BG') {
                    ctx.save(); ctx.fillStyle = cmd[1];
                    ctx.fillRect(0,0,w,h); ctx.restore();
                }

                if (delay > 0) await new Promise(r => setTimeout(r, delay));
            }
        }

        async function runCode() {
            if (!pyodide) return;

            _turtleAbort = true;  // Laufende Turtle-Animation abbrechen
            await new Promise(r => setTimeout(r, 20));
            _turtleAbort = false;

            clearOutput();
            const code = editor.getValue();

            if (!code.trim()) {
                appendLine('(Kein Code zum Ausführen)', 'info');
                return;
            }

            const hasTurtle = /\bimport\s+turtle\b|\bfrom\s+turtle\s+import\b/.test(code);
            if (hasTurtle) {
                prepareTurtleCanvas();
            } else {
                hideTurtleCanvas();
            }

            const runBtn = document.getElementById('runBtn');
            runBtn.disabled = true;
            runBtn.textContent = hasTurtle ? '🐢 Läuft…' : '⏳ Läuft…';

            _errBuf = '';
            highlightErrorLine(null);

            try {
                await pyodide.runPythonAsync(code);

                if (hasTurtle) {
                    // Aufgezeichnete Befehle abrufen und animieren
                    const cmdsJson = pyodide.runPython(
                        'import sys, json; json.dumps(sys.modules["turtle"]._t._cmds)'
                    );
                    const speed = pyodide.runPython('sys.modules["turtle"]._t._speed');
                    const cmds = JSON.parse(String(cmdsJson));
                    const delay = _turtleDelay(Number(speed));

                    runBtn.textContent = '🐢 Zeichnet…';
                    await animateTurtle(document.getElementById('turtleCanvas'), cmds, delay);

                    if (!_turtleAbort) {
                        appendLine('\n🐢 Turtle-Grafik fertig.\n', 'ok');
                    }
                } else {
                    appendLine('\n✓ Programm erfolgreich beendet.\n', 'ok');
                }

                const trimmedCode = code.trim();
                if (!_seenCodes.has(trimmedCode)) {
                    _seenCodes.add(trimmedCode);
                    _successCount++;
                    if (_successCount % 5 === 0) {
                        const idx = Math.min(Math.floor(_successCount / 5) - 1, MOTIVATIONS.length - 1);
                        _confettiActive = true;
                        document.getElementById('wickieBubble').classList.remove('show');
                        setTimeout(() => launchConfetti(MOTIVATIONS[idx]), 100);
                    }
                }
                if (!_confettiActive) {
                    const isComplex = /\b(for|while|if|elif|else|def|class|import|try|with|lambda|return)\b/.test(code)
                        || code.trim().split('\n').length > 4;
                    if (isComplex) setTimeout(() => showWickieSuccess(), 200);
                }
            } catch (err) {
                appendLine('\n✗ Ausführung abgebrochen.\n', 'err');
                if (_errBuf) setTimeout(() => showWickieTip(_errBuf), 200);
            } finally {
                runBtn.disabled = false;
                runBtn.innerHTML = '▶ Ausführen';
            }
        }

        // ─── Beschreibung live als Kommentar im Editor ────────────────────────────────

        const DESC_MARKER = '# 📝 ';

        function getCodeWithoutDesc() {
            const lines = editor.getValue().split('\n');
            if (lines[0] && lines[0].startsWith(DESC_MARKER)) {
                // strip: desc line + sep + blank line
                return lines.slice(3).join('\n');
            }
            return editor.getValue();
        }

        function syncDescComment() {
            const desc = document.getElementById('descInput').value.trim();
            const code = getCodeWithoutDesc();
            const pos = editor.getCursor();
            const scroll = editor.getScrollInfo();
            if (desc) {
                const descLine = `${DESC_MARKER}${desc}`;
                const sep = '# ' + '-'.repeat(descLine.length - 2);
                const block = `${descLine}\n${sep}\n\n`;
                editor.setValue(block + code);
                editor.setCursor({ line: Math.max(0, pos.line + (editor.getValue().startsWith(DESC_MARKER) ? 0 : 3)), ch: pos.ch });
            } else {
                editor.setValue(code);
                editor.setCursor(pos);
            }
            editor.scrollTo(scroll.left, scroll.top);
        }

        document.getElementById('descInput').addEventListener('input', syncDescComment);

        // ─── Save .py ─────────────────────────────────────────────────────────────────

        document.getElementById('saveBtn').addEventListener('click', () => {
            const blob = new Blob([editor.getValue()], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'code.py';
            a.click();
            URL.revokeObjectURL(a.href);
        });

        // ─── Load .py ─────────────────────────────────────────────────────────────────

        document.getElementById('fileInput').addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                const current = editor.getValue().trim();
                if (!current || confirm('Den aktuellen Code ersetzen?')) {
                    editor.setValue(ev.target.result);
                    editor.focus();
                }
            };
            reader.readAsText(file);
            this.value = '';
        });

        // ─── Toolbar run button ───────────────────────────────────────────────────────

        document.getElementById('runBtn').addEventListener('click', runCode);
        document.getElementById('clearBtn')?.addEventListener('click', clearOutput);

        // ─── Schriftgröße + Header-Skalierung ────────────────────────────────────────

        let currentFontSize = 14;
        function setEditorFontSize(size) {
            currentFontSize = Math.max(10, Math.min(28, size));
            document.querySelector('.CodeMirror').style.fontSize = currentFontSize + 'px';
            editor.refresh();
        }
        document.getElementById('fontBigBtn').addEventListener('click', () => setEditorFontSize(currentFontSize + 2));
        document.getElementById('fontSmallBtn').addEventListener('click', () => setEditorFontSize(currentFontSize - 2));

        // ─── Hell/Dunkel Modus ────────────────────────────────────────────────────────

        let isDark = localStorage.getItem('wickie-theme') !== 'light';
        function applyTheme() {
            document.body.classList.toggle('light', !isDark);
            document.getElementById('cmTheme').disabled = !isDark;
            editor.setOption('theme', isDark ? 'dracula' : 'default');
            const themeBtn = document.getElementById('themeToggle');
            themeBtn.querySelector('.toggle-icon').textContent = isDark ? '🌙' : '☀️';
            themeBtn.querySelector('.toggle-label').textContent = isDark ? 'Dunkel' : 'Hell';
            localStorage.setItem('wickie-theme', isDark ? 'dark' : 'light');
        }
        applyTheme();
        document.getElementById('themeToggle').addEventListener('click', () => {
            isDark = !isDark;
            applyTheme();
        });

        // ─── Aufgaben via URL-Parameter (?aufgabe=...) ────────────────────────────────

        (function loadTask() {
            const params = new URLSearchParams(window.location.search);
            const aufgabe = params.get('aufgabe');
            if (aufgabe) {
                document.getElementById('taskText').textContent = aufgabe;
                document.getElementById('taskPanel').classList.add('show');
            }
        })();


        // ══════════════════════════════════════════════════════════════════════
        //  SUPABASE – Konfiguration
        //  1. Erstelle ein kostenloses Projekt auf https://supabase.com
        //  2. Gehe zu Project Settings → API
        //  3. Kopiere "Project URL" und "anon public" Key hierher
        // ══════════════════════════════════════════════════════════════════════
        const SUPABASE_URL = 'https://pqxpxeemhdjpipggyhgz.supabase.co';
        const SUPABASE_KEY = 'sb_publishable_jbJW0m89PVGXoT6_rmgQ0Q_-4DKlNVk';

        const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // ── Auth State ────────────────────────────────────────────────────────
        let currentUser = null;
        let currentProfile = null;
        let _currentProjectId = null;
        let _currentProjectTitle = null;
        let _currentTaskId = null;
        let _currentTaskData = null;

        let _realtimeChannel = null;

        _sb.auth.onAuthStateChange((_event, session) => {
            currentUser = session?.user ?? null;
            updateAuthUI();
            if (currentUser) {
                checkStudentClass();
                setupProfileRealtime();
            } else {
                if (_realtimeChannel) { _sb.removeChannel(_realtimeChannel); _realtimeChannel = null; }
            }
        });

        function setupProfileRealtime() {
            if (_realtimeChannel) _sb.removeChannel(_realtimeChannel);
            _realtimeChannel = _sb.channel('profile-watch')
                .on('postgres_changes', {
                    event: 'UPDATE', schema: 'public', table: 'profiles',
                    filter: `id=eq.${currentUser.id}`
                }, () => checkStudentClass())
                .subscribe();
        }

        async function initAuth() {
            const { data } = await _sb.auth.getSession();
            currentUser = data.session?.user ?? null;
            updateAuthUI();
            if (currentUser) {
                checkStudentClass();
                if (new URLSearchParams(window.location.search).get('profile') === '1') {
                    setTimeout(() => openProfileModal(), 400);
                    history.replaceState(null, '', window.location.pathname);
                }
            }
        }

        async function checkStudentClass() {
            if (!currentUser) return;
            const { data } = await _sb.from('profiles').select('class_id, role').eq('id', currentUser.id).single();
            const isStudent = data?.role === 'student' || currentUser?.user_metadata?.role === 'student';
            const hasClass = data?.class_id;
            const btn = document.getElementById('joinClassBtn2');
            if (btn) btn.style.display = (isStudent && !hasClass) ? 'inline-flex' : 'none';
        }

        // ── Aufgaben (Student) ────────────────────────────────────────────────────
        async function openTasksModal() {
            openModal('tasksModal');
            const list = document.getElementById('tasksList');
            list.innerHTML = '<div style="color:#6c7086;font-size:0.85rem;padding:10px 0">Lade Aufgaben…</div>';
            const { data: profile } = await _sb.from('profiles').select('class_id').eq('id', currentUser.id).single();
            if (!profile?.class_id) {
                list.innerHTML = '<div style="color:#6c7086;font-size:0.85rem">Du bist noch in keiner Klasse.</div>';
                return;
            }
            const { data: tasks } = await _sb.from('tasks').select('*').eq('class_id', profile.class_id).order('created_at', { ascending: false });
            if (!tasks?.length) {
                list.innerHTML = '<div style="color:#6c7086;font-size:0.85rem">Noch keine Aufgaben vorhanden.</div>';
                return;
            }
            const { data: mySubs } = await _sb.from('task_submissions').select('task_id,status').eq('user_id', currentUser.id);
            const subMap = {};
            for (const s of (mySubs || [])) subMap[s.task_id] = s.status;

            list.innerHTML = tasks.map(task => {
                const status = subMap[task.id];
                let badge = '<span style="color:#6c7086;font-size:0.78rem">○ Offen</span>';
                if (status === 'in_progress') badge = '<span style="color:#f9e2af;font-size:0.78rem">✏️ In Bearbeitung</span>';
                if (status === 'submitted') badge = '<span style="color:#a6e3a1;font-size:0.78rem">✓ Abgegeben</span>';
                const due = task.due_date ? `<span style="font-size:0.75rem;color:#6c7086"> · bis ${new Date(task.due_date).toLocaleDateString('de-DE')}</span>` : '';
                return `<div onclick="showTaskDetail('${task.id}')" style="background:#1e1e2e;border:1px solid #313244;border-radius:12px;padding:14px 16px;margin-bottom:8px;cursor:pointer;transition:border-color 0.2s" onmouseover="this.style.borderColor='#89b4fa'" onmouseout="this.style.borderColor='#313244'">
                    <div style="font-weight:700;margin-bottom:4px;color:#cdd6f4">${escapeHtml(task.title)}</div>
                    <div style="display:flex;align-items:center;gap:10px">${badge}${due}</div>
                </div>`;
            }).join('');
            list._tasks = tasks;
        }

        function showTaskDetail(taskId) {
            const tasks = document.getElementById('tasksList')._tasks || [];
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;
            _currentTaskData = task;
            document.getElementById('taskDetailTitle').innerHTML = `📝 <span>${escapeHtml(task.title)}</span>`;
            document.getElementById('taskDetailDesc').innerHTML = task.description
                ? escapeHtml(task.description).replace(/\n/g, '<br>')
                : '<span style="color:#6c7086">Keine Beschreibung.</span>';
            const starterWrap = document.getElementById('taskDetailStarterWrap');
            if (task.starter_code) {
                document.getElementById('taskDetailStarter').textContent = task.starter_code;
                starterWrap.style.display = 'block';
            } else {
                starterWrap.style.display = 'none';
            }
            closeModal('tasksModal');
            openModal('taskDetailModal');
        }

        async function startTask() {
            if (!_currentTaskData) return;
            const task = _currentTaskData;
            closeModal('taskDetailModal');
            _currentTaskId = task.id;

            const { data: existing } = await _sb.from('task_submissions')
                .select('*').eq('task_id', task.id).eq('user_id', currentUser.id).single();

            const code = existing?.code || task.starter_code || '';
            createTab(`📝 ${task.title}`, code, '', null, null, task.id);
            const tab = getActiveTab();
            if (tab) tab.taskStatus = existing?.status || 'open';
            appendLine(`\n📝 Aufgabe "${task.title}" geöffnet.\n`, 'ok');
            updateTaskModeUI();
            const submitBtn = document.getElementById('submitTaskBtn');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = existing?.status === 'submitted' ? '✓ Abgegeben' : '✅ Abgeben';
            }
        }

        function updateTaskModeUI() {
            const tab = getActiveTab();
            const inTaskMode = !!tab?.taskId;
            const submitBtn = document.getElementById('submitTaskBtn');
            const taskSaveBtn = document.getElementById('taskSaveBtn');
            const saveBtn = document.getElementById('cloudSaveBtn');
            const updateBtn = document.getElementById('updateProjectBtn');
            if (submitBtn) {
                submitBtn.style.display = inTaskMode ? 'inline-flex' : 'none';
                if (!inTaskMode) { submitBtn.disabled = false; submitBtn.textContent = '✅ Abgeben'; }
            }
            if (taskSaveBtn) taskSaveBtn.style.display = inTaskMode ? 'inline-flex' : 'none';
            if (saveBtn) saveBtn.style.display = inTaskMode ? 'none' : (currentUser ? 'inline-flex' : 'none');
            if (updateBtn && !inTaskMode) {
                updateBtn.style.display = (currentUser && tab?.projectId) ? 'inline-flex' : 'none';
            } else if (updateBtn) {
                updateBtn.style.display = 'none';
            }
        }

        async function saveTaskProgress() {
            const tab = getActiveTab();
            if (!tab?.taskId) return;
            const saveBtn = document.getElementById('taskSaveBtn');
            if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '…'; }
            try {
                // Nicht von 'submitted' auf 'in_progress' zurücksetzen
                const newStatus = tab.taskStatus === 'submitted' ? 'submitted' : 'in_progress';
                const { error } = await _sb.from('task_submissions').upsert({
                    task_id: tab.taskId, user_id: currentUser.id,
                    code: editor.getValue(), status: newStatus,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'task_id,user_id' });
                if (error) throw error;
                if (tab.taskStatus !== 'submitted') tab.taskStatus = 'in_progress';
                appendLine('\n💾 Aufgabe gespeichert.\n', 'ok');
            } catch(err) {
                appendLine(`\n✗ Fehler beim Speichern: ${err.message}\n`, 'err');
            } finally {
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Speichern'; }
            }
        }

        async function submitTask() {
            const tab = getActiveTab();
            if (!tab?.taskId) return;
            const btn = document.getElementById('submitTaskBtn');
            const origText = btn.textContent;
            btn.disabled = true; btn.textContent = '…';
            try {
                const { error } = await _sb.from('task_submissions').upsert({
                    task_id: tab.taskId, user_id: currentUser.id,
                    code: editor.getValue(), status: 'submitted',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'task_id,user_id' });
                if (error) throw error;
                tab.taskStatus = 'submitted';
                appendLine('\n✅ Aufgabe abgegeben!\n', 'ok');
                btn.disabled = false;
                btn.textContent = '✓ Abgegeben';
            } catch(err) {
                appendLine(`\n✗ Fehler beim Abgeben: ${err.message}\n`, 'err');
                btn.disabled = false; btn.textContent = origText;
            }
        }

        function openJoinClassModal() {
            const logo = document.querySelector('header .logo img')?.src;
            if (logo) document.getElementById('joinClassLogo').src = logo;
            document.getElementById('joinCodeInput').value = '';
            document.getElementById('joinClassError').style.display = 'none';
            openModal('joinClassModal');
        }

        async function joinClass() {
            const code = document.getElementById('joinCodeInput').value.trim().toUpperCase();
            const errEl = document.getElementById('joinClassError');
            const btn = document.getElementById('joinClassBtn');

            function showErr(msg) {
                errEl.textContent = msg;
                errEl.style.display = 'block';
            }
            errEl.style.display = 'none';
            errEl.textContent = '';

            if (!code || code.length < 4) { showErr('Bitte einen gültigen Code eingeben.'); return; }

            btn.disabled = true; btn.textContent = '…';

            const { data: cls, error: findErr } = await _sb.from('classes').select('id,name').eq('join_code', code).single();
            if (findErr || !cls) {
                showErr('Ungültiger Code – ' + (findErr?.message || 'nicht gefunden'));
                btn.disabled = false; btn.textContent = 'Klasse beitreten';
                return;
            }

            const { error: updateErr } = await _sb.from('profiles').update({ class_id: cls.id }).eq('id', currentUser.id);
            btn.disabled = false; btn.textContent = 'Klasse beitreten';
            if (updateErr) { showErr('Fehler: ' + updateErr.message); return; }

            document.getElementById('joinClassModal').classList.remove('open');
            const joinBtn = document.getElementById('joinClassBtn2');
            if (joinBtn) joinBtn.style.display = 'none';
        }

        function updateAuthUI() {
            const loggedIn = !!currentUser;
            const isTeacher = currentUser?.user_metadata?.role === 'teacher';
            document.getElementById('authBtn').style.display = loggedIn ? 'none' : 'flex';
            document.getElementById('userMenu').style.display = loggedIn ? 'flex' : 'none';
            document.getElementById('cloudSaveBtn').style.display = loggedIn ? 'inline-flex' : 'none';
            document.getElementById('myProjectsBtn').style.display = loggedIn ? 'inline-flex' : 'none';
            if (loggedIn) setTimeout(updateTaskModeUI, 0);
            document.getElementById('dashboardBtn').style.display = (loggedIn && isTeacher) ? 'inline-flex' : 'none';
            document.getElementById('qrBtn').style.display = (loggedIn && isTeacher) ? 'inline-flex' : 'none';
            const isStudent = loggedIn && !isTeacher;
            document.getElementById('aufgabenBtn').style.display = isStudent ? 'inline-flex' : 'none';
            if (!loggedIn) {
                _currentProjectId = null; _currentProjectTitle = null;
                document.getElementById('updateProjectBtn').style.display = 'none';
                document.getElementById('activeProjectLabel').style.display = 'none';
            }
            if (loggedIn) {
                const fn = currentUser.user_metadata?.first_name || '';
                const ln = currentUser.user_metadata?.last_name || '';
                const displayName = [fn, ln].filter(Boolean).join(' ') || currentUser.email;
                document.getElementById('userEmail').textContent = displayName;
            }
        }

        // ── Auth Modal ────────────────────────────────────────────────────────
        let _authMode = 'login';

        (function copyLogoToModal() {
            const src = document.querySelector('header .logo img')?.src;
            if (src) document.getElementById('authModalLogo').src = src;
        })();

        const STUDENT_KEY = 'try: lernen()';
        const TEACHER_KEY = 'Class Teacher {}';

        function openAuthModal(mode) {
            _authMode = mode || 'login';
            switchAuthMode(_authMode);
            document.getElementById('authEmail').value = '';
            document.getElementById('authPassword').value = '';
            document.getElementById('authFirstName').value = '';
            document.getElementById('authLastName').value = '';
            document.getElementById('authSchoolKey').value = '';
            document.getElementById('authTeacherKey').value = '';
            document.getElementById('roleSchüler').checked = true;
            document.getElementById('teacherKeyField').style.display = 'none';
            hideAuthFeedback();
            openModal('authModal');
            setTimeout(() => document.getElementById('authEmail').focus(), 200);
        }

        function switchAuthMode(mode) {
            _authMode = mode;
            const isLogin = mode === 'login';
            document.getElementById('authModalTitle').innerHTML = isLogin
                ? '<span>Anmelden</span>'
                : 'Konto <span>erstellen</span>';
            document.getElementById('authSubmitBtn').textContent = isLogin ? 'Anmelden' : 'Registrieren';
            document.getElementById('authSwitch').innerHTML = isLogin
                ? 'Noch kein Konto? <a onclick="switchAuthMode(\'register\')">Registrieren</a>'
                : 'Schon ein Konto? <a onclick="switchAuthMode(\'login\')">Anmelden</a>';
            document.getElementById('registerOnlyFields').style.display = isLogin ? 'none' : 'block';
            hideAuthFeedback();
        }

        function hideAuthFeedback() {
            document.getElementById('authError').classList.remove('show');
            document.getElementById('authSuccess').classList.remove('show');
        }

        // Lehrer-Key-Feld ein-/ausblenden je nach Rollenwahl
        document.querySelectorAll('input[name="authRole"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const isTeacher = document.getElementById('roleLehrer').checked;
                document.getElementById('teacherKeyField').style.display = isTeacher ? 'block' : 'none';
                document.getElementById('schoolKeyLabel').textContent = isTeacher ? 'Schulcode (optional)' : 'Schulcode';
            });
        });

        function showAuthError(msg) {
            const e = document.getElementById('authError');
            e.textContent = msg;
            e.classList.add('show');
        }

        async function handleAuthSubmit() {
            const email = document.getElementById('authEmail').value.trim();
            const password = document.getElementById('authPassword').value;
            const btn = document.getElementById('authSubmitBtn');
            if (!email || !password) return;

            btn.disabled = true;
            btn.textContent = '…';
            hideAuthFeedback();

            try {
                if (_authMode === 'login') {
                    const { error } = await _sb.auth.signInWithPassword({ email, password });
                    if (error) throw error;
                    closeModal('authModal');
                } else {
                    const firstName  = document.getElementById('authFirstName').value.trim();
                    const lastName   = document.getElementById('authLastName').value.trim();
                    const isTeacher  = document.getElementById('roleLehrer').checked;
                    const schoolKey  = document.getElementById('authSchoolKey').value.trim();
                    const teacherKey = document.getElementById('authTeacherKey').value.trim();

                    if (!firstName) { showAuthError('Bitte Vorname eingeben.'); throw null; }

                    // Key-Validierung
                    if (isTeacher) {
                        if (teacherKey !== TEACHER_KEY) {
                            showAuthError('Lehrer-Bestätigungscode ist falsch.'); throw null;
                        }
                    } else {
                        if (schoolKey !== STUDENT_KEY) {
                            showAuthError('Schulcode ist falsch.'); throw null;
                        }
                    }

                    const role = isTeacher ? 'teacher' : 'student';
                    const { data, error } = await _sb.auth.signUp({
                        email, password,
                        options: { data: { first_name: firstName, last_name: lastName, role } }
                    });
                    if (error) throw error;

                    // Profil anlegen
                    if (data?.user) {
                        await _sb.from('profiles').insert({
                            id: data.user.id,
                            first_name: firstName,
                            last_name: lastName,
                            role
                        });
                    }

                    const s = document.getElementById('authSuccess');
                    s.textContent = 'Konto erstellt! Bitte E-Mail bestätigen, dann anmelden.';
                    s.classList.add('show');
                    switchAuthMode('login');
                }
            } catch (err) {
                if (err) showAuthError(err.message || 'Fehler beim Anmelden.');
            } finally {
                btn.disabled = false;
                btn.textContent = _authMode === 'login' ? 'Anmelden' : 'Registrieren';
            }
        }

        async function doLogout() {
            await _sb.auth.signOut();
        }

        // ── Profil bearbeiten ─────────────────────────────────────────────────
        function openProfileModal() {
            document.getElementById('profileFirstName').value = currentUser?.user_metadata?.first_name || '';
            document.getElementById('profileLastName').value = currentUser?.user_metadata?.last_name || '';
            document.getElementById('profileEmail').value = currentUser?.email || '';
            document.getElementById('profilePassword').value = '';
            document.getElementById('profilePasswordConfirm').value = '';
            document.getElementById('profileError').style.display = 'none';
            document.getElementById('profileSuccess').style.display = 'none';
            openModal('profileModal');
            setTimeout(() => document.getElementById('profileFirstName').focus(), 200);
        }

        async function saveProfile() {
            const firstName = document.getElementById('profileFirstName').value.trim();
            const lastName  = document.getElementById('profileLastName').value.trim();
            const email     = document.getElementById('profileEmail').value.trim();
            const pw        = document.getElementById('profilePassword').value;
            const pw2       = document.getElementById('profilePasswordConfirm').value;
            const errEl     = document.getElementById('profileError');
            const successEl = document.getElementById('profileSuccess');
            const btn       = document.getElementById('profileSaveBtn');

            errEl.style.display = 'none';
            successEl.style.display = 'none';

            if (!firstName) { errEl.textContent = 'Vorname darf nicht leer sein.'; errEl.style.display = 'block'; return; }
            if (pw && pw.length < 6) { errEl.textContent = 'Passwort muss mindestens 6 Zeichen haben.'; errEl.style.display = 'block'; return; }
            if (pw && pw !== pw2) { errEl.textContent = 'Passwörter stimmen nicht überein.'; errEl.style.display = 'block'; return; }

            btn.disabled = true; btn.textContent = '…';

            const authUpdates = { data: { first_name: firstName, last_name: lastName } };
            if (email && email !== currentUser.email) authUpdates.email = email;
            if (pw) authUpdates.password = pw;

            const { error: authErr } = await _sb.auth.updateUser(authUpdates);
            if (authErr) {
                errEl.textContent = 'Fehler: ' + authErr.message;
                errEl.style.display = 'block';
                btn.disabled = false; btn.textContent = 'Speichern';
                return;
            }

            await _sb.from('profiles').update({ first_name: firstName, last_name: lastName }).eq('id', currentUser.id);

            const { data: { user } } = await _sb.auth.getUser();
            currentUser = user;
            updateAuthUI();

            btn.disabled = false; btn.textContent = 'Speichern';
            successEl.textContent = email && email !== currentUser.email
                ? '✓ Gespeichert. Bitte bestätige die neue E-Mail in deinem Postfach.'
                : '✓ Profil gespeichert!';
            successEl.style.display = 'block';
        }

        function openDeleteAccountModal() {
            document.getElementById('deleteAccountPassword').value = '';
            document.getElementById('deleteAccountError').classList.remove('show');
            openModal('deleteAccountModal');
            setTimeout(() => document.getElementById('deleteAccountPassword').focus(), 200);
        }

        async function handleDeleteAccount() {
            const password = document.getElementById('deleteAccountPassword').value;
            const btn = document.getElementById('deleteAccountBtn2');
            const errEl = document.getElementById('deleteAccountError');
            if (!password) { errEl.textContent = 'Bitte Passwort eingeben.'; errEl.classList.add('show'); return; }

            btn.disabled = true; btn.textContent = '…';
            errEl.classList.remove('show');

            try {
                // Re-authenticate first
                const { error: loginErr } = await _sb.auth.signInWithPassword({
                    email: currentUser.email, password
                });
                if (loginErr) throw new Error('Falsches Passwort.');

                // Delete account via DB function (requires delete_user() in Supabase)
                const { error } = await _sb.rpc('delete_user');
                if (error) throw error;

                await _sb.auth.signOut();
                closeModal('deleteAccountModal');
                appendLine('\n🗑 Konto wurde gelöscht.\n', 'ok');
            } catch (err) {
                errEl.textContent = err.message || 'Fehler beim Löschen.';
                errEl.classList.add('show');
                btn.disabled = false; btn.textContent = '🗑 Konto endgültig löschen';
            }
        }

        // Enter-Taste im Auth-Modal
        ['authEmail', 'authPassword', 'authFirstName', 'authLastName', 'authSchoolKey', 'authTeacherKey'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') handleAuthSubmit();
            });
        });

        // ── Tab-System ───────────────────────────────────────────────────────
        let _tabs = [];
        let _activeTabId = null;
        let _tabCounter = 0;

        function _newTabId() { return 'tab_' + (++_tabCounter); }

        function getActiveTab() {
            return _tabs.find(t => t.id === _activeTabId) || null;
        }

        function saveCurrentTabState() {
            const tab = getActiveTab();
            if (!tab) return;
            tab.code = editor.getValue();
            tab.description = document.getElementById('descInput')?.value || '';
        }

        function renderTabBar() {
            const bar = document.getElementById('tabBar');
            const newBtn = document.getElementById('newTabBtn');
            // remove old tab elements (keep newTabBtn)
            bar.querySelectorAll('.tab').forEach(el => el.remove());

            _tabs.forEach(tab => {
                const el = document.createElement('div');
                el.className = 'tab' + (tab.id === _activeTabId ? ' active' : '');
                el.dataset.id = tab.id;
                const unsaved = tab.projectId ? '' : '<span class="tab-unsaved">●</span>';
                el.innerHTML = `<span class="tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</span>${unsaved}<button class="tab-close" title="Tab schließen">×</button>`;
                el.addEventListener('click', e => {
                    if (e.target.classList.contains('tab-close')) { closeTab(tab.id); return; }
                    switchTab(tab.id);
                });
                el.addEventListener('dblclick', e => {
                    if (e.target.classList.contains('tab-close')) return;
                    renameTab(tab.id);
                });
                bar.insertBefore(el, newBtn);
            });
        }

        function createTab(title, code, desc, projectId, projectTitle, taskId) {
            saveCurrentTabState();
            const id = _newTabId();
            _tabs.push({
                id,
                title: title || 'Neu',
                code: code || '',
                description: desc || '',
                projectId: projectId || null,
                projectTitle: projectTitle || null,
                taskId: taskId || null,
            });
            _activeTabId = id;
            _loadTabIntoEditor(id);
            renderTabBar();
            updateTaskModeUI();
        }

        function switchTab(id) {
            if (id === _activeTabId) return;
            saveCurrentTabState();
            _activeTabId = id;
            _loadTabIntoEditor(id);
            renderTabBar();
            updateTaskModeUI();
        }

        function _loadTabIntoEditor(id) {
            const tab = _tabs.find(t => t.id === id);
            if (!tab) return;
            editor.setValue(tab.code);
            const descEl = document.getElementById('descInput');
            if (descEl) descEl.value = tab.description;
            // Aktualisieren-Button wird von updateTaskModeUI() gesteuert
            editor.focus();
            updateAiContext();
        }

        function closeTab(id) {
            if (_tabs.length === 1) return; // mindestens einen Tab behalten
            const idx = _tabs.findIndex(t => t.id === id);
            _tabs.splice(idx, 1);
            if (_activeTabId === id) {
                const newIdx = Math.min(idx, _tabs.length - 1);
                _activeTabId = _tabs[newIdx].id;
                _loadTabIntoEditor(_activeTabId);
            }
            renderTabBar();
            updateTaskModeUI();
        }

        function renameTab(id) {
            const tab = _tabs.find(t => t.id === id);
            if (!tab) return;
            const name = prompt('Tab umbenennen:', tab.title);
            if (name !== null && name.trim()) {
                tab.title = name.trim();
                renderTabBar();
            }
        }

        // ── Projekt speichern ─────────────────────────────────────────────────

        function openSaveTitleModal() {
            const tab = getActiveTab();
            if (tab?.taskId) { saveTaskProgress(); return; }
            document.getElementById('saveTitleInput').value = '';
            document.getElementById('saveError').classList.remove('show');
            openModal('saveTitleModal');
            setTimeout(() => document.getElementById('saveTitleInput').focus(), 200);
        }

        document.getElementById('saveTitleInput').addEventListener('keydown', e => {
            if (e.key === 'Enter') handleCloudSave();
        });

        async function handleCloudSaveTask() {
            await saveTaskProgress();
        }

        async function handleCloudSave() {
            const tab = getActiveTab();
            if (tab?.taskId) { await saveTaskProgress(); return; }
            const title = document.getElementById('saveTitleInput').value.trim() || 'Unbenannt';
            const btn = document.getElementById('saveSubmitBtn');
            btn.disabled = true; btn.textContent = '…';

            try {
                const desc = document.getElementById('descInput')?.value.trim() || '';
                const code = editor.getValue();
                const { data, error } = await _sb.from('submissions').insert({
                    user_id: currentUser.id,
                    title,
                    description: desc,
                    code,
                }).select().single();
                if (error) throw error;
                // Aktuellen Tab mit neuer Projekt-ID verknüpfen
                const tab = getActiveTab();
                if (tab) {
                    tab.title = title;
                    tab.projectId = data.id;
                    tab.projectTitle = title;
                    renderTabBar();
                }
                closeModal('saveTitleModal');
                appendLine(`\n☁️ Projekt "${title}" gespeichert.\n`, 'ok');
            } catch (err) {
                const e = document.getElementById('saveError');
                e.textContent = err.message;
                e.classList.add('show');
            } finally {
                btn.disabled = false; btn.textContent = '☁️ Speichern';
            }
        }

        // ── Projekte laden & anzeigen ─────────────────────────────────────────
        async function openProjectsModal() {
            openModal('projectsModal');
            const list = document.getElementById('projectsList');
            list.innerHTML = '<div class="projects-empty">Lade Projekte…</div>';

            try {
                const { data, error } = await _sb.from('submissions')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .order('updated_at', { ascending: false });
                if (error) throw error;

                if (!data.length) {
                    list.innerHTML = '<div class="projects-empty">Noch keine Projekte gespeichert.</div>';
                    return;
                }

                list.innerHTML = '';
                data.forEach(proj => {
                    const date = new Date(proj.updated_at).toLocaleDateString('de-DE', {
                        day: '2-digit', month: '2-digit', year: 'numeric'
                    });
                    const card = document.createElement('div');
                    card.className = 'project-card';
                    card.innerHTML = `
                        <div class="project-card-info">
                            <div class="project-card-title">${escapeHtml(proj.title)}</div>
                            <div class="project-card-desc">${escapeHtml(proj.description || '–')}</div>
                        </div>
                        <span class="project-card-date">${date}</span>
                        <button class="project-del-btn" title="Löschen" onclick="deleteProject('${proj.id}', event)">🗑</button>
                    `;
                    card.addEventListener('click', () => loadProject(proj));
                    list.appendChild(card);
                });
            } catch (err) {
                list.innerHTML = `<div class="projects-empty" style="color:#f38ba8">${err.message}</div>`;
            }
        }

        function loadProject(proj) {
            // Prüfen ob Tab bereits offen
            const existing = _tabs.find(t => t.projectId === proj.id);
            if (existing) { switchTab(existing.id); closeModal('projectsModal'); return; }
            createTab(proj.title, proj.code, proj.description || '', proj.id, proj.title);
            closeModal('projectsModal');
            appendLine(`\n📁 Projekt "${proj.title}" in neuem Tab geladen.\n`, 'ok');
        }

        async function handleUpdateProject() {
            const tab = getActiveTab();
            if (!tab?.projectId) return;
            const btn = document.getElementById('updateProjectBtn');
            btn.disabled = true; btn.textContent = '…';
            try {
                const desc = document.getElementById('descInput')?.value.trim() || '';
                const { error } = await _sb.from('submissions').update({
                    code: editor.getValue(),
                    description: desc,
                    updated_at: new Date().toISOString(),
                }).eq('id', tab.projectId);
                if (error) throw error;
                appendLine(`\n💾 Projekt "${tab.projectTitle}" aktualisiert.\n`, 'ok');
            } catch (err) {
                appendLine(`\n✗ Fehler: ${err.message}\n`, 'err');
            } finally {
                btn.disabled = false; btn.textContent = '💾 Aktualisieren';
            }
        }

        async function deleteProject(id, event) {
            event.stopPropagation();
            if (!confirm('Projekt wirklich löschen?')) return;
            const { error } = await _sb.from('submissions').delete().eq('id', id);
            if (!error) openProjectsModal();
        }

        // ── Modal Hilfsfunktionen ─────────────────────────────────────────────
        function openModal(id) {
            document.getElementById(id).classList.add('open');
        }
        function closeModal(id) {
            document.getElementById(id).classList.remove('open');
        }
        // Klick außerhalb schließt Modal
        document.querySelectorAll('.sb-modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', e => {
                if (e.target === overlay) overlay.classList.remove('open');
            });
        });

        // ── QR-Code ───────────────────────────────────────────────────────────
        function openQrModal() {
            document.getElementById('qrTaskInput').value = '';
            document.getElementById('qrCodeBox').style.display = 'none';
            document.getElementById('qrCanvas').innerHTML = '';
            openModal('qrModal');
            setTimeout(() => document.getElementById('qrTaskInput').focus(), 200);
        }

        function generateQr() {
            const task = document.getElementById('qrTaskInput').value.trim();
            if (!task) return;
            const base = location.href.split('?')[0];
            const url = `${base}?aufgabe=${encodeURIComponent(task)}`;
            const box = document.getElementById('qrCanvas');
            box.innerHTML = '';
            new QRCode(box, { text: url, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
            document.getElementById('qrUrlText').textContent = url;
            document.getElementById('qrCodeBox').style.display = 'block';
        }

        function escapeHtml(str) {
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        // ─── Boot ─────────────────────────────────────────────────────────────────────


        // ══════════════════════════════════════════════════════════════════════
        //  KI-ASSISTENT (Groq)
        // ══════════════════════════════════════════════════════════════════════
        const GROQ_PROXY = 'https://pqxpxeemhdjpipggyhgz.supabase.co/functions/v1/groq-proxy';
        const GROQ_MODEL = 'llama-3.3-70b-versatile';
        let aiChatOpen = false;
        let aiHistory = [];

        const AI_SYSTEM = `Du bist Wickie, ein freundlicher Python-Lernassistent für Schülerinnen und Schüler in der Schule.

WICHTIGSTE REGEL — NIEMALS BRECHEN:
Du gibst KEINE fertigen Lösungen oder vollständigen Code-Antworten. Schüler sollen selbst denken und lernen.

WAS DU STATTDESSEN MACHST:
- Gib Denkanstöße: "Was passiert, wenn du...?", "Schau dir Zeile X an — was fällt dir auf?"
- Erkläre das Konzept hinter dem Problem, nicht die Lösung
- Zeige kleine, isolierte Beispiele die NICHT direkt die Aufgabe lösen (z.B. bei einer Schleifenfrage: zeige eine Schleife über Zahlen, nicht über die Aufgabendaten)
- Stelle Gegenfragen: "Was hat dein Code bisher gemacht? Was fehlt noch?"
- Gib Tipps wie: "Schau dir den Befehl 'range()' an" oder "Vielleicht hilft hier eine 'if'-Bedingung"
- Lobe Fortschritte und ermutige

WEITERE REGELN:
- Antworte NUR auf Fragen zu Python-Programmierung
- Antworte immer auf Deutsch, klar und schülerfreundlich
- Bei Nicht-Python-Fragen: freundlich ablehnen und auf Python hinweisen
- Nutze keine langen Fachbegriffe ohne kurze Erklärung
- Maximal 3-4 kurze Absätze pro Antwort
- Wenn ein Schüler direkt nach der Lösung fragt: freundlich erklären dass du nicht die Lösung gibst, sondern beim Denken hilfst`;

        function toggleChat() {
            aiChatOpen = !aiChatOpen;
            const panel = document.getElementById('aiChatPanel');
            panel.classList.toggle('open', aiChatOpen);
            if (aiChatOpen) {
                updateAiContext();
                setTimeout(() => document.getElementById('aiChatInput').focus(), 300);
            }
        }

        function updateAiContext() {
            const code = editor.getValue().trim();
            const taskText = document.getElementById('taskText')?.textContent?.trim();
            const info = document.getElementById('aiContextInfo');
            const parts = [];
            if (taskText) parts.push(`📋 Aufgabe geladen`);
            if (code) parts.push(`${code.split('\n').length} Zeilen Code`);
            if (_errBuf) parts.push(`⚠️ Fehler erkannt`);
            if (info) info.textContent = parts.length ? parts.join(' · ') : 'Kein Code im Editor';
        }

        function clearAiChat() {
            aiHistory = [];
            const msgs = document.getElementById('aiChatMessages');
            msgs.innerHTML = `<div class="ai-msg bot">Hallo! 👋 Ich bin Wickie, dein Python-Assistent.<br>Ich helfe dir bei <strong>Python-Fragen</strong> und deinen <strong>gespeicherten Projekten</strong>.<br>Was möchtest du wissen?</div>`;
        }

        document.getElementById('aiChatInput')?.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage(); }
        });

        async function sendAiMessage() {
            const input = document.getElementById('aiChatInput');
            const msg = input.value.trim();
            if (!msg) return;

            input.value = '';
            document.getElementById('aiChatSend').disabled = true;

            appendChatMsg(msg, 'user');

            // Build context: code + last error + task
            const code = editor.getValue().trim();
            const taskText = document.getElementById('taskText')?.textContent?.trim();
            let context = '';
            if (taskText) context += `\nAufgabe des Schülers: "${taskText}"`;
            if (code) context += `\n\nAktueller Code im Editor:\n\`\`\`python\n${code.slice(0, 1500)}\n\`\`\``;
            if (_errBuf) context += `\n\nLetzter Fehler:\n${_errBuf.slice(0, 600)}`;

            const userMsg = msg + (context ? `\n\n[Kontext:${context}]` : '');

            aiHistory.push({ role: 'user', content: userMsg });

            const typingEl = appendChatMsg('Wickie tippt…', 'typing');

            try {
                const resp = await fetch(GROQ_PROXY, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_KEY,
                    },
                    body: JSON.stringify({
                        model: GROQ_MODEL,
                        messages: [
                            { role: 'system', content: AI_SYSTEM },
                            ...aiHistory.slice(-8)
                        ],
                        max_tokens: 800,
                        temperature: 0.6
                    })
                });

                if (!resp.ok) throw new Error(`API Fehler ${resp.status}`);
                const data = await resp.json();
                const answer = data.choices[0].message.content;

                typingEl.remove();
                aiHistory.push({ role: 'assistant', content: answer });
                appendChatMsg(formatAiText(answer), 'bot', true);
            } catch (err) {
                typingEl.remove();
                appendChatMsg('Fehler: ' + err.message, 'error');
            } finally {
                document.getElementById('aiChatSend').disabled = false;
                input.focus();
            }
        }

        function appendChatMsg(text, cls, isHTML = false) {
            const div = document.createElement('div');
            div.className = 'ai-msg ' + cls;
            if (isHTML) div.innerHTML = text; else div.textContent = text;
            document.getElementById('aiChatMessages').appendChild(div);
            div.scrollIntoView({ behavior: 'smooth' });
            return div;
        }

        function formatAiText(text) {
            // Code blocks
            text = text.replace(/```python([\s\S]*?)```/g, '<pre>$1</pre>');
            text = text.replace(/```([\s\S]*?)```/g, '<pre>$1</pre>');
            // Inline code
            text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
            // Bold
            text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            // Line breaks
            text = text.replace(/\n/g, '<br>');
            return text;
        }
        // Ersten Standard-Tab erstellen
        createTab('Neu', editor.getValue(), '', null, null);

        // ─── Lehrer Dashboard ─────────────────────────────────────────────────────

        let _dashStudents = [];
        let _dashSubmissions = [];

        function _avatarColor(name) {
            const colors = ['#f38ba8','#fab387','#f9e2af','#a6e3a1','#89dceb','#89b4fa','#cba6f7','#eba0ac'];
            let h = 0;
            for (const c of (name || '?')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
            return colors[Math.abs(h) % colors.length];
        }

        function _relTime(dateStr) {
            if (!dateStr) return 'Noch nicht aktiv';
            const diff = Date.now() - new Date(dateStr).getTime();
            const min = Math.floor(diff / 60000);
            const hrs = Math.floor(min / 60);
            const days = Math.floor(hrs / 24);
            if (min < 2) return 'Gerade eben';
            if (min < 60) return `vor ${min} Min.`;
            if (hrs < 24) return `vor ${hrs} Std.`;
            if (days === 1) return 'Gestern';
            if (days < 7) return `vor ${days} Tagen`;
            return new Date(dateStr).toLocaleDateString('de-DE');
        }

        function _escHtml(s) {
            return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        }

        function openDashboard() {
            window.location.href = 'dashboard.html';
        }

        async function loadDashboard() {
            document.getElementById('dashBody').innerHTML = '<div class="dash-loading">⏳ Lade Daten…</div>';
            document.getElementById('statStudents').textContent = '—';
            document.getElementById('statProjects').textContent = '—';
            document.getElementById('statToday').textContent = '—';

            const [{ data: students }, { data: subs }] = await Promise.all([
                _sb.from('profiles').select('*').eq('role', 'student').order('first_name'),
                _sb.from('submissions').select('id,user_id,title,description,code,created_at,updated_at').order('updated_at', { ascending: false })
            ]);

            _dashStudents = students || [];
            _dashSubmissions = subs || [];

            // Stats
            const today = new Date(); today.setHours(0,0,0,0);
            const todayActive = new Set(
                (_dashSubmissions || [])
                    .filter(s => new Date(s.updated_at || s.created_at) >= today)
                    .map(s => s.user_id)
            ).size;

            document.getElementById('statStudents').textContent = _dashStudents.length;
            document.getElementById('statProjects').textContent = _dashSubmissions.length;
            document.getElementById('statToday').textContent = todayActive;

            renderStudentGrid(_dashStudents);
        }

        function renderStudentGrid(students) {
            const body = document.getElementById('dashBody');
            if (!students.length) {
                body.innerHTML = '<div class="dash-empty">Noch keine Schüler registriert.</div>';
                return;
            }
            const grid = document.createElement('div');
            grid.className = 'dash-students-grid';

            for (const s of students) {
                const subs = _dashSubmissions.filter(p => p.user_id === s.id);
                const lastSub = subs[0];
                const sFullName = [s.first_name, s.last_name].filter(Boolean).join(' ') || '?';
                const color = _avatarColor(sFullName);
                const initial = sFullName[0].toUpperCase();
                const card = document.createElement('div');
                card.className = 'dash-student-card';
                card.innerHTML = `
                    <div class="dash-student-top">
                        <div class="dash-avatar" style="background:${color}">${initial}</div>
                        <div class="dash-student-info">
                            <div class="dash-student-name">${_escHtml(sFullName)}</div>
                            <div class="dash-student-email">${_escHtml(s.id)}</div>
                        </div>
                    </div>
                    <div class="dash-student-meta">
                        <span class="dash-meta-pill">📁 ${subs.length} Projekt${subs.length !== 1 ? 'e' : ''}</span>
                        <span class="dash-meta-time">🕐 ${_relTime(lastSub?.updated_at || lastSub?.created_at)}</span>
                    </div>`;
                card.addEventListener('click', () => renderStudentDetail(s));
                grid.appendChild(card);
            }
            body.innerHTML = '';
            body.appendChild(grid);
        }

        function renderStudentDetail(student) {
            const subs = _dashSubmissions.filter(p => p.user_id === student.id);
            const sFullName = [student.first_name, student.last_name].filter(Boolean).join(' ') || '?';
            const color = _avatarColor(sFullName);
            const initial = sFullName[0].toUpperCase();
            const body = document.getElementById('dashBody');

            let html = `
                <button class="dash-back-btn" onclick="renderStudentGrid(_dashStudents)">← Zurück</button>
                <div class="dash-detail-header">
                    <div class="dash-detail-avatar" style="background:${color}">${initial}</div>
                    <div>
                        <div class="dash-detail-name">${_escHtml(sFullName)}</div>
                        <div class="dash-detail-email">${_escHtml(student.id)}</div>
                    </div>
                </div>`;

            if (!subs.length) {
                html += '<div class="dash-empty">Dieser Schüler hat noch keine Projekte gespeichert.</div>';
            } else {
                html += '<div class="dash-project-list">';
                for (const sub of subs) {
                    const dateStr = new Date(sub.updated_at || sub.created_at).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
                    html += `
                        <div class="dash-project-card">
                            <div class="dash-project-head" onclick="toggleDashCode(this)">
                                <div>
                                    <div class="dash-project-title">📄 ${_escHtml(sub.title || 'Unbenannt')}</div>
                                    ${sub.description ? `<div class="dash-project-desc">${_escHtml(sub.description)}</div>` : ''}
                                </div>
                                <div style="display:flex;align-items:center;flex-shrink:0">
                                    <span class="dash-project-date">${dateStr}</span>
                                    <span class="dash-project-toggle">▼</span>
                                </div>
                            </div>
                            <div class="dash-project-code">
                                <pre class="dash-code-pre">${_escHtml(sub.code || '')}</pre>
                            </div>
                        </div>`;
                }
                html += '</div>';
            }

            body.innerHTML = html;
        }

        function toggleDashCode(headEl) {
            const card = headEl.closest('.dash-project-card');
            const codeEl = card.querySelector('.dash-project-code');
            const toggle = card.querySelector('.dash-project-toggle');
            codeEl.classList.toggle('open');
            toggle.classList.toggle('open');
        }

        function filterDashStudents() {
            const q = document.getElementById('dashSearch').value.toLowerCase();
            const filtered = _dashStudents.filter(s => {
                const n = [s.first_name, s.last_name].filter(Boolean).join(' ').toLowerCase();
                return n.includes(q);
            });
            renderStudentGrid(filtered);
        }

        // ─────────────────────────────────────────────────────────────────────────

        document.getElementById('joinClassBtn')?.addEventListener('click', joinClass);

        initPyodide();
        if (SUPABASE_URL !== 'DEINE_SUPABASE_URL_HIER') initAuth();
