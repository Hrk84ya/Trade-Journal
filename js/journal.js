import storage from './storage.js';

class JournalManager {
    constructor() {
        this.currentDate = this.todayStr();
        this.currentSection = 'premarket';
        this.autosaveTimer = null;
        this.dirty = false;
    }

    init() {
        this.bindEvents();
        this.setDate(this.todayStr());
        this.renderEntriesList();
    }

    todayStr() {
        return new Date().toISOString().split('T')[0];
    }

    // --- Event binding ---

    bindEvents() {
        // Date navigation
        const dateInput = document.getElementById('journal-date');
        if (dateInput) {
            dateInput.addEventListener('change', () => this.setDate(dateInput.value));
        }
        document.getElementById('journal-prev-day')?.addEventListener('click', () => this.shiftDate(-1));
        document.getElementById('journal-next-day')?.addEventListener('click', () => this.shiftDate(1));
        document.getElementById('journal-today-btn')?.addEventListener('click', () => this.setDate(this.todayStr()));

        // Section tabs
        document.querySelectorAll('.journal-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.saveCurrentToBuffer();
                this.currentSection = tab.dataset.section;
                document.querySelectorAll('.journal-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.loadSectionIntoEditor();
            });
        });

        // Save button
        document.getElementById('journal-save-btn')?.addEventListener('click', () => this.save());

        // Preview toggle
        document.getElementById('journal-toggle-preview')?.addEventListener('click', () => this.togglePreview());

        // Toolbar buttons
        document.querySelectorAll('.toolbar-btn[data-md]').forEach(btn => {
            btn.addEventListener('click', () => this.insertWrapMarkdown(btn.dataset.md));
        });
        document.querySelectorAll('.toolbar-btn[data-md-line]').forEach(btn => {
            btn.addEventListener('click', () => this.insertLinePrefix(btn.dataset.mdLine));
        });
        document.querySelectorAll('.toolbar-btn[data-md-block]').forEach(btn => {
            btn.addEventListener('click', () => this.insertBlock(btn.dataset.mdBlock));
        });

        // Autosave on typing (debounced 2s)
        const editor = document.getElementById('journal-editor');
        if (editor) {
            editor.addEventListener('input', () => {
                this.dirty = true;
                this.showAutosaveStatus('Unsaved changes...');
                clearTimeout(this.autosaveTimer);
                this.autosaveTimer = setTimeout(() => this.autosave(), 2000);
            });

            // Keyboard shortcuts
            editor.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    this.save();
                }
                if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                    e.preventDefault();
                    this.insertWrapMarkdown('**');
                }
                if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                    e.preventDefault();
                    this.insertWrapMarkdown('*');
                }
            });
        }
    }

    // --- Date navigation ---

    setDate(dateStr) {
        this.currentDate = dateStr;
        const dateInput = document.getElementById('journal-date');
        if (dateInput) dateInput.value = dateStr;
        this.buffer = null;
        this.loadEntry();
    }

    shiftDate(days) {
        const d = new Date(this.currentDate + 'T12:00:00');
        d.setDate(d.getDate() + days);
        this.setDate(d.toISOString().split('T')[0]);
    }

    // --- Load / Save ---

    loadEntry() {
        const entry = storage.getJournalEntry(this.currentDate);
        this.buffer = entry ? { ...entry } : { premarket: '', review: '', lessons: '', freeform: '' };
        this.loadSectionIntoEditor();
        this.dirty = false;
        this.showAutosaveStatus('');
    }

    loadSectionIntoEditor() {
        const editor = document.getElementById('journal-editor');
        const preview = document.getElementById('journal-preview');
        if (editor) editor.value = this.buffer?.[this.currentSection] || '';
        if (preview && preview.style.display !== 'none') {
            this.updatePreview();
        }
    }

    saveCurrentToBuffer() {
        if (!this.buffer) return;
        const editor = document.getElementById('journal-editor');
        if (editor) this.buffer[this.currentSection] = editor.value;
    }

    async save() {
        this.saveCurrentToBuffer();
        if (!this.buffer) return;

        // Don't save completely empty entries
        const hasContent = ['premarket', 'review', 'lessons', 'freeform'].some(k => this.buffer[k]?.trim());
        if (!hasContent) {
            await storage.deleteJournalEntry(this.currentDate);
        } else {
            await storage.saveJournalEntry(this.currentDate, this.buffer);
        }
        this.dirty = false;
        this.showAutosaveStatus('Saved ✓');
        this.renderEntriesList();
        setTimeout(() => this.showAutosaveStatus(''), 2000);
    }

    async autosave() {
        if (!this.dirty) return;
        await this.save();
    }

    // --- Markdown toolbar helpers ---

    insertWrapMarkdown(marker) {
        const editor = document.getElementById('journal-editor');
        if (!editor) return;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const text = editor.value;
        const selected = text.substring(start, end);
        const replacement = `${marker}${selected || 'text'}${marker}`;
        editor.value = text.substring(0, start) + replacement + text.substring(end);
        editor.focus();
        editor.selectionStart = start + marker.length;
        editor.selectionEnd = start + marker.length + (selected.length || 4);
        editor.dispatchEvent(new Event('input'));
    }

    insertLinePrefix(prefix) {
        const editor = document.getElementById('journal-editor');
        if (!editor) return;
        const start = editor.selectionStart;
        const text = editor.value;
        // Find the start of the current line
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        editor.value = text.substring(0, lineStart) + prefix + text.substring(lineStart);
        editor.focus();
        editor.selectionStart = editor.selectionEnd = start + prefix.length;
        editor.dispatchEvent(new Event('input'));
    }

    insertBlock(fence) {
        const editor = document.getElementById('journal-editor');
        if (!editor) return;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const text = editor.value;
        const selected = text.substring(start, end);
        const block = `\n${fence}\n${selected || ''}\n${fence}\n`;
        editor.value = text.substring(0, start) + block + text.substring(end);
        editor.focus();
        const cursorPos = start + fence.length + 2;
        editor.selectionStart = editor.selectionEnd = cursorPos;
        editor.dispatchEvent(new Event('input'));
    }

    // --- Preview ---

    togglePreview() {
        const editor = document.getElementById('journal-editor');
        const preview = document.getElementById('journal-preview');
        const btn = document.getElementById('journal-toggle-preview');
        if (!editor || !preview) return;

        if (preview.style.display === 'none') {
            this.updatePreview();
            preview.style.display = 'block';
            editor.style.display = 'none';
            btn?.querySelector('i')?.classList.replace('fa-eye', 'fa-edit');
        } else {
            preview.style.display = 'none';
            editor.style.display = 'block';
            btn?.querySelector('i')?.classList.replace('fa-edit', 'fa-eye');
        }
    }

    updatePreview() {
        const editor = document.getElementById('journal-editor');
        const preview = document.getElementById('journal-preview');
        if (!editor || !preview) return;
        // Use marked.js (loaded globally via CDN)
        if (typeof marked !== 'undefined') {
            preview.innerHTML = marked.parse(editor.value || '*Nothing here yet...*');
        } else {
            // Fallback: just show raw text
            preview.textContent = editor.value;
        }
    }

    // --- Entries sidebar ---

    renderEntriesList() {
        const container = document.getElementById('journal-entries-list');
        if (!container) return;

        const dates = storage.getJournalDates();
        if (dates.length === 0) {
            container.innerHTML = '<p class="journal-empty">No journal entries yet. Start writing!</p>';
            return;
        }

        container.innerHTML = dates.slice(0, 30).map(dateStr => {
            const entry = storage.getJournalEntry(dateStr);
            const isActive = dateStr === this.currentDate;
            // Build a snippet from the first non-empty section
            const snippet = this.getSnippet(entry);
            const sections = this.getSectionIcons(entry);
            const d = new Date(dateStr + 'T12:00:00');
            const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

            return `<div class="journal-entry-item ${isActive ? 'active' : ''}" data-date="${dateStr}">
                <div class="journal-entry-date">${label}</div>
                <div class="journal-entry-snippet">${this.escapeHtml(snippet)}</div>
                <div class="journal-entry-sections">${sections}</div>
            </div>`;
        }).join('');

        container.querySelectorAll('.journal-entry-item').forEach(item => {
            item.addEventListener('click', () => this.setDate(item.dataset.date));
        });
    }

    getSnippet(entry) {
        if (!entry) return '';
        for (const key of ['premarket', 'review', 'lessons', 'freeform']) {
            if (entry[key]?.trim()) {
                const text = entry[key].trim().replace(/[#*_~`>\-\[\]]/g, '');
                return text.length > 80 ? text.substring(0, 80) + '...' : text;
            }
        }
        return '';
    }

    getSectionIcons(entry) {
        if (!entry) return '';
        const icons = [];
        if (entry.premarket?.trim()) icons.push('<i class="fas fa-sun" title="Pre-Market"></i>');
        if (entry.review?.trim()) icons.push('<i class="fas fa-moon" title="EOD Review"></i>');
        if (entry.lessons?.trim()) icons.push('<i class="fas fa-lightbulb" title="Lessons"></i>');
        if (entry.freeform?.trim()) icons.push('<i class="fas fa-pen" title="Notes"></i>');
        return icons.join(' ');
    }

    showAutosaveStatus(msg) {
        const el = document.getElementById('journal-autosave-status');
        if (el) el.textContent = msg;
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

const journalManager = new JournalManager();
export default journalManager;
