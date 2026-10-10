import { useEffect, useMemo, useRef, useState } from 'react';

const timerModes = [
  { name: 'Focus', value: 25, mode: 'focus' },
  { name: 'Short Break', value: 5, mode: 'short' },
  { name: 'Long Break', value: 15, mode: 'long' },
];

const colorPalette = ['#d77a57', '#9e7a60', '#768d6d', '#d8b36a', '#c9726d', '#7a8ca6'];

const createSubject = (name, color = colorPalette[Math.floor(Math.random() * colorPalette.length)]) => ({
  id: `${name.toLowerCase()}-${Date.now()}`,
  name,
  files: [],
  notes: '',
  createdAt: new Date().toISOString(),
  progress: 0,
  color,
});

const normalizeSubjectData = (subject) => ({
  id: subject.id || `${subject.name?.toLowerCase?.() || 'subject'}-${Date.now()}`,
  name: subject.name || 'Untitled subject',
  files: Array.isArray(subject.files) ? subject.files : [],
  notes: typeof subject.notes === 'string' ? subject.notes : '',
  createdAt: subject.createdAt || new Date().toISOString(),
  progress: Number.isFinite(subject.progress) ? subject.progress : 0,
  color: subject.color || colorPalette[0],
});

const calculateProgress = (subject) => {
  if (!subject) return 0;
  const noteLength = (subject.notes || '').trim().length;
  const fileCount = (subject.files || []).length;

  if (noteLength > 200 && fileCount > 0) return 100;
  if (noteLength > 100 || fileCount > 3) return 75;
  if (noteLength > 50 || fileCount > 1) return 50;
  if (noteLength > 0 || fileCount > 0) return 25;
  return 0;
};

const formatTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatDate = (value) => {
  if (!value) return 'Today';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Today' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const fileTypeIcons = {
  pdf: 'fa-file-pdf',
  doc: 'fa-file-word',
  docx: 'fa-file-word',
  txt: 'fa-file-lines',
  ppt: 'fa-file-powerpoint',
  pptx: 'fa-file-powerpoint',
  xls: 'fa-file-excel',
  xlsx: 'fa-file-excel',
  jpg: 'fa-file-image',
  jpeg: 'fa-file-image',
  png: 'fa-file-image',
  gif: 'fa-file-image',
  mp4: 'fa-file-video',
  mov: 'fa-file-video',
  avi: 'fa-file-video',
  default: 'fa-file',
};

const getFileIcon = (name) => {
  const extension = String(name).split('.').pop()?.toLowerCase() || '';
  return fileTypeIcons[extension] || fileTypeIcons.default;
};

const App = () => {
  const [subjects, setSubjects] = useState(new Map());
  const [currentSubject, setCurrentSubject] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [currentMode, setCurrentMode] = useState('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [viewMode, setViewMode] = useState('grid');
  const [notesContent, setNotesContent] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [subjectDraft, setSubjectDraft] = useState('');
  const [studyStats, setStudyStats] = useState({ totalTime: 0, sessionsCompleted: 0 });
  const textAreaRef = useRef(null);

  useEffect(() => {
    try {
      const savedSubjects = localStorage.getItem('study-organizer-subjects');
      const savedStats = localStorage.getItem('study-organizer-stats');
      const savedTheme = localStorage.getItem('study-organizer-theme') || 'light';

      if (savedSubjects) {
        const parsed = JSON.parse(savedSubjects);
        const nextMap = new Map((parsed || []).map(([name, value]) => [name, normalizeSubjectData(value || { name })]));
        setSubjects(nextMap);
        if (nextMap.size > 0) {
          setCurrentSubject((previousName) => previousName || nextMap.keys().next().value);
        }
      }

      if (savedStats) {
        setStudyStats({ ...{ totalTime: 0, sessionsCompleted: 0 }, ...JSON.parse(savedStats) });
      }

      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
    } catch (error) {
      console.error('Failed to load saved study data:', error);
    }
  }, []);

  useEffect(() => {
    const serializedSubjects = JSON.stringify(Array.from(subjects.entries()));
    localStorage.setItem('study-organizer-subjects', serializedSubjects);
    localStorage.setItem('study-organizer-theme', theme);
    localStorage.setItem('study-organizer-stats', JSON.stringify(studyStats));
    document.documentElement.dataset.theme = theme;
  }, [subjects, theme, studyStats]);

  useEffect(() => {
    if (!currentSubject) {
      setNotesContent('');
      return;
    }

    const activeSubject = subjects.get(currentSubject);
    setNotesContent(activeSubject?.notes || '');
  }, [currentSubject, subjects]);

  useEffect(() => {
    if (!isRunning) return undefined;

    const interval = window.setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(interval);
          setIsRunning(false);
          const activeMode = timerModes.find((entry) => entry.mode === currentMode) || timerModes[0];
          setStudyStats((prevStats) => ({
            totalTime: prevStats.totalTime + activeMode.value * 60,
            sessionsCompleted: prevStats.sessionsCompleted + 1,
          }));
          showNotification(
            activeMode.mode === 'focus' ? 'Focus session complete. Time for a break.' : 'Break complete. Ready to focus again.',
            'success'
          );
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRunning, currentMode]);

  const showNotification = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setNotifications((previous) => [...previous, { id, message, type }]);
    window.setTimeout(() => {
      setNotifications((previous) => previous.filter((notification) => notification.id !== id));
    }, 3000);
  };

  const updateSubjectProgress = (subjectName, nextSubject) => {
    setSubjects((previous) => {
      const nextMap = new Map(previous);
      const target = nextMap.get(subjectName);
      if (!target) return previous;
      nextMap.set(subjectName, { ...target, ...nextSubject, progress: calculateProgress({ ...target, ...nextSubject }) });
      return nextMap;
    });
  };

  const addSubject = () => {
    const trimmedName = subjectDraft.trim();
    if (!trimmedName) {
      showNotification('Give your subject a name first.', 'warning');
      return;
    }

    setSubjects((previous) => {
      const nextMap = new Map(previous);
      if (nextMap.has(trimmedName)) {
        showNotification('That subject already exists.', 'error');
        return previous;
      }

      const newSubject = createSubject(trimmedName);
      nextMap.set(trimmedName, newSubject);
      setCurrentSubject(trimmedName);
      setSubjectDraft('');
      showNotification('Subject added.', 'success');
      return nextMap;
    });
  };

  const deleteSubject = (name) => {
    setSubjects((previous) => {
      const nextMap = new Map(previous);
      nextMap.delete(name);
      if (currentSubject === name) {
        setCurrentSubject(nextMap.size > 0 ? nextMap.keys().next().value : null);
      }
      showNotification('Subject removed.', 'success');
      return nextMap;
    });
  };

  const handleFileUpload = (uploadedFiles) => {
    if (!currentSubject) {
      showNotification('Select a subject before adding files.', 'warning');
      return;
    }

    const fileList = Array.from(uploadedFiles || []);
    if (fileList.length === 0) return;

    const nextFiles = fileList.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      name: file.name,
      type: file.type || 'file',
      size: file.size,
      uploadedAt: new Date().toISOString(),
      data: file.type.startsWith('image/') || file.type.startsWith('application/') ? URL.createObjectURL(file) : '',
    }));

    setSubjects((previous) => {
      const nextMap = new Map(previous);
      const target = nextMap.get(currentSubject);
      if (!target) return previous;
      const mergedFiles = [...target.files, ...nextFiles];
      const updatedSubject = { ...target, files: mergedFiles, progress: calculateProgress({ ...target, files: mergedFiles }) };
      nextMap.set(currentSubject, updatedSubject);
      showNotification(`${fileList.length} file(s) uploaded.`, 'success');
      return nextMap;
    });
  };

  const deleteFile = (fileId) => {
    if (!currentSubject) return;

    setSubjects((previous) => {
      const nextMap = new Map(previous);
      const target = nextMap.get(currentSubject);
      if (!target) return previous;
      const filteredFiles = target.files.filter((file) => file.id !== fileId);
      const updatedSubject = { ...target, files: filteredFiles, progress: calculateProgress({ ...target, files: filteredFiles }) };
      nextMap.set(currentSubject, updatedSubject);
      showNotification('File removed.', 'success');
      return nextMap;
    });
  };

  const saveNotes = (value) => {
    if (!currentSubject) return;
    setSubjects((previous) => {
      const nextMap = new Map(previous);
      const subject = nextMap.get(currentSubject);
      if (!subject) return previous;
      const updated = { ...subject, notes: value, progress: calculateProgress({ ...subject, notes: value }) };
      nextMap.set(currentSubject, updated);
      return nextMap;
    });
    setNotesContent(value);
  };

  const applyNoteFormat = (pattern) => {
    const field = textAreaRef.current;
    if (!field || !currentSubject) return;

    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selected = field.value.slice(start, end) || 'text';

    const insertions = {
      bold: `**${selected}**`,
      italic: `*${selected}*`,
      link: `[${selected}](https://example.com)`,
      bullet: `${selected ? `\n- ${selected}` : '\n- '}`,
      heading: `${selected ? `\n## ${selected}` : '\n## '}`,
    };

    const nextValue = `${field.value.slice(0, start)}${insertions[pattern]}${field.value.slice(end)}`;
    field.value = nextValue;
    saveNotes(nextValue);

    window.requestAnimationFrame(() => {
      field.focus();
      const nextCursor = start + insertions[pattern].length;
      field.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const resetTimer = () => {
    const mode = timerModes.find((entry) => entry.mode === currentMode) || timerModes[0];
    setIsRunning(false);
    setTimeLeft(mode.value * 60);
  };

  const switchTimerMode = (modeName) => {
    const nextMode = timerModes.find((entry) => entry.mode === modeName) || timerModes[0];
    setCurrentMode(nextMode.mode);
    setIsRunning(false);
    setTimeLeft(nextMode.value * 60);
  };

  const filteredSubjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return [...subjects.keys()].filter((name) => name.toLowerCase().includes(query));
  }, [searchQuery, subjects]);

  const currentSubjectData = currentSubject ? subjects.get(currentSubject) : null;

  const sortedFiles = useMemo(() => {
    if (!currentSubjectData) return [];
    const files = [...currentSubjectData.files];
    return files.sort((a, b) => {
      if (sortBy === 'size') return b.size - a.size;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return new Date(b.uploadedAt) - new Date(a.uploadedAt);
    });
  }, [currentSubjectData, sortBy]);

  const totalProgress = subjects.size
    ? Math.round(Array.from(subjects.values()).reduce((sum, subject) => sum + (subject.progress || 0), 0) / subjects.size)
    : 0;

  const totalSubjects = subjects.size;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="menu-toggle" type="button" onClick={() => setSidebarOpen((previous) => !previous)} aria-label="Toggle navigation">
          <i className={`fa-solid ${sidebarOpen ? 'fa-bars-staggered' : 'fa-xmark'}`} />
        </button>

        <div className="brand-block">
          <div className="brand-mark">
            <i className="fa-solid fa-graduation-cap" />
          </div>
          <div>
            <span className="brand-kicker">Study desk</span>
            <h1>Study Organizer</h1>
          </div>
        </div>

        <nav className="nav-pills" aria-label="Main navigation">
          <a href="#overview"><i className="fa-solid fa-house" /> Overview</a>
          <a href="#materials"><i className="fa-solid fa-folder-open" /> Materials</a>
          <a href="#notes"><i className="fa-solid fa-pen-nib" /> Notes</a>
        </nav>

        <div className="header-actions">
          <button type="button" className="icon-btn" aria-label="Focus mode" onClick={() => setFocusMode((previous) => !previous)}>
            <i className={`fa-solid ${focusMode ? 'fa-eye-slash' : 'fa-eye'}`} />
          </button>
          <button type="button" className="icon-btn" aria-label="Toggle theme" onClick={() => setTheme((previous) => (previous === 'light' ? 'dark' : 'light'))}>
            <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`} />
          </button>
        </div>
      </header>

      <div className={`workspace ${focusMode ? 'focus-mode' : ''}`}>
        {!focusMode && (
          <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
            <div className="search-box">
              <i className="fa-solid fa-magnifying-glass" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search subjects"
                aria-label="Search subjects"
              />
            </div>

            <div className="stat-grid">
              <div className="stat-card">
                <strong>{totalSubjects}</strong>
                <span>Subjects</span>
              </div>
              <div className="stat-card">
                <strong>{studyStats.sessionsCompleted}</strong>
                <span>Sessions</span>
              </div>
              <div className="stat-card">
                <strong>{totalProgress}%</strong>
                <span>Progress</span>
              </div>
            </div>

            <div className="panel-heading">
              <h2><i className="fa-solid fa-book" /> Subjects</h2>
            </div>

            <div className="subject-create">
              <input
                type="text"
                value={subjectDraft}
                onChange={(event) => setSubjectDraft(event.target.value)}
                placeholder="Add a subject"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addSubject();
                }}
              />
              <button type="button" className="primary-btn" onClick={addSubject}>
                <i className="fa-solid fa-plus" /> Add
              </button>
            </div>

            <ul className="subject-list">
              {filteredSubjects.length === 0 ? (
                <li className="empty-card">
                  <i className="fa-solid fa-book-open" />
                  <h3>No subjects yet</h3>
                  <p>Create a new subject to get started.</p>
                </li>
              ) : (
                filteredSubjects.map((name) => {
                  const subject = subjects.get(name);
                  return (
                    <li
                      key={name}
                      className={`subject-item ${currentSubject === name ? 'active' : ''}`}
                      onClick={() => setCurrentSubject(name)}
                    >
                      <span className="subject-dot" style={{ background: subject?.color || '#d77a57' }} />
                      <div className="subject-content">
                        <span className="subject-name">{name}</span>
                        <div className="mini-progress">
                          <span style={{ width: `${subject?.progress || 0}%` }} />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ghost-btn small"
                        aria-label={`Delete ${name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteSubject(name);
                        }}
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="summary-panel">
              <div className="panel-heading">
                <h3><i className="fa-solid fa-chart-column" /> Progress</h3>
              </div>
              <div className="progress-track">
                <span style={{ width: `${totalProgress}%` }} />
              </div>
              <p>{totalProgress}% complete</p>
            </div>
          </aside>
        )}

        <main className="main-panel" id="overview">
          <section className="panel-card timer-panel">
            <div className="panel-heading">
              <h2><i className="fa-solid fa-clock" /> Focus timer</h2>
            </div>

            <div className={`timer-display ${isRunning ? 'running' : ''}`}>{formatTime(timeLeft)}</div>

            <div className="timer-actions">
              <button type="button" className="primary-btn" onClick={() => setIsRunning(true)} disabled={isRunning}>
                <i className="fa-solid fa-play" /> Start
              </button>
              <button type="button" className="secondary-btn" onClick={() => setIsRunning(false)} disabled={!isRunning}>
                <i className="fa-solid fa-pause" /> Pause
              </button>
              <button type="button" className="secondary-btn" onClick={resetTimer}>
                <i className="fa-solid fa-rotate-right" /> Reset
              </button>
            </div>

            <div className="mode-switcher">
              {timerModes.map((mode) => (
                <button
                  key={mode.mode}
                  type="button"
                  className={`mode-btn ${currentMode === mode.mode ? 'active' : ''}`}
                  onClick={() => switchTimerMode(mode.mode)}
                >
                  {mode.name}
                </button>
              ))}
            </div>
          </section>

          <section className="panel-card materials-panel" id="materials">
            <div className="section-header">
              <div className="panel-heading">
                <h2><i className="fa-solid fa-folder" /> {currentSubject ? currentSubject : 'Study materials'}</h2>
              </div>

              <div className="toolbar-inline">
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort files">
                  <option value="date">Sort by Date</option>
                  <option value="size">Sort by Size</option>
                  <option value="name">Sort by Name</option>
                </select>
                <button type="button" className="icon-btn" onClick={() => setViewMode((previous) => (previous === 'grid' ? 'list' : 'grid'))} aria-label="Toggle file view">
                  <i className={`fa-solid ${viewMode === 'grid' ? 'fa-list' : 'fa-table-cells-large'}`} />
                </button>
              </div>
            </div>

            <div
              className="dropzone"
              onClick={() => {
                if (!currentSubject) {
                  showNotification('Select a subject before uploading.', 'warning');
                  return;
                }
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.multiple = true;
                fileInput.onchange = (event) => handleFileUpload(event.target.files);
                fileInput.click();
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.currentTarget.classList.add('dragging');
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                event.currentTarget.classList.remove('dragging');
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.currentTarget.classList.remove('dragging');
                handleFileUpload(event.dataTransfer.files);
              }}
            >
              <i className="fa-solid fa-cloud-arrow-up" />
              <div>
                <strong>Drop files here or click to upload</strong>
                <span>PDF, documents, images, and videos</span>
              </div>
            </div>

            <div className={`file-grid ${viewMode}`}>
              {!currentSubject ? (
                <div className="empty-card full-width">
                  <i className="fa-solid fa-folder-open" />
                  <h3>Select a subject</h3>
                  <p>Choose a subject to manage its study materials.</p>
                </div>
              ) : sortedFiles.length === 0 ? (
                <div className="empty-card full-width">
                  <i className="fa-solid fa-file-circle-plus" />
                  <h3>No files here yet</h3>
                  <p>Upload your notes, slides, or reference files.</p>
                </div>
              ) : (
                sortedFiles.map((file) => (
                  <article key={file.id} className={`file-card ${viewMode}`}>
                    <div className="file-icon-wrap">
                      <i className={`fa-solid ${getFileIcon(file.name)}`} />
                    </div>

                    <div className="file-body">
                      <strong>{file.name}</strong>
                      <span>
                        {formatFileSize(file.size)} • {formatDate(file.uploadedAt)}
                      </span>
                    </div>

                    <div className="file-actions">
                      {file.data ? (
                        <a href={file.data} download={file.name} className="mini-action download" aria-label={`Download ${file.name}`}>
                          <i className="fa-solid fa-download" />
                        </a>
                      ) : (
                        <span className="mini-action disabled" aria-label="Download unavailable">
                          <i className="fa-solid fa-download" />
                        </span>
                      )}
                      <button type="button" className="mini-action danger" aria-label={`Delete ${file.name}`} onClick={() => deleteFile(file.id)}>
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="panel-card notes-panel" id="notes">
            <div className="panel-heading">
              <h2><i className="fa-solid fa-pen-to-square" /> Notes</h2>
            </div>

            <div className="editor-toolbar">
              <button type="button" className="tool-btn" onClick={() => applyNoteFormat('bold')} aria-label="Bold text">
                <i className="fa-solid fa-bold" />
              </button>
              <button type="button" className="tool-btn" onClick={() => applyNoteFormat('italic')} aria-label="Italic text">
                <i className="fa-solid fa-italic" />
              </button>
              <button type="button" className="tool-btn" onClick={() => applyNoteFormat('link')} aria-label="Insert link">
                <i className="fa-solid fa-link" />
              </button>
              <button type="button" className="tool-btn" onClick={() => applyNoteFormat('bullet')} aria-label="Bullet list">
                <i className="fa-solid fa-list-ul" />
              </button>
              <button type="button" className="tool-btn" onClick={() => applyNoteFormat('heading')} aria-label="Heading">
                <i className="fa-solid fa-heading" />
              </button>
            </div>

            <textarea
              ref={textAreaRef}
              className="notes-editor"
              value={notesContent}
              onChange={(event) => saveNotes(event.target.value)}
              placeholder={currentSubject ? 'Capture class summaries, formulas, and reminders...' : 'Select a subject to start writing notes.'}
              disabled={!currentSubject}
            />
          </section>
        </main>
      </div>

      <div className="notification-stack" aria-live="polite">
        {notifications.map((notification) => (
          <div key={notification.id} className={`toast ${notification.type}`}>
            <i className={`fa-solid ${notification.type === 'success' ? 'fa-circle-check' : notification.type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info'}`} />
            <span>{notification.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
