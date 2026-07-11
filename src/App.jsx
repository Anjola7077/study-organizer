import React, { useState, useEffect } from 'react';

const App = () => {
  const [subjects, setSubjects] = useState(new Map());
  const [currentSubject, setCurrentSubject] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState('light');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [currentMode, setCurrentMode] = useState('focus');
  const [timerModes] = useState([
    { name: 'Focus', time: 25, mode: 'focus' },
    { name: 'Short Break', time: 5, mode: 'short' },
    { name: 'Long Break', time: 15, mode: 'long' },
  ]);
  const [notifications, setNotifications] = useState([]);
  const [notesContent, setNotesContent] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [studyStats, setStudyStats] = useState({ totalTime: 0, sessionsCompleted: 0 });
  const [focusMode, setFocusMode] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    loadFromStorage();
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : '';
  }, []);

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (currentSubject) {
      const subject = subjects.get(currentSubject);
      setNotesContent(subject?.notes || '');
    }
  }, [currentSubject, subjects]);

  const saveToStorage = () => {
    try {
      localStorage.setItem('sop-subjects', JSON.stringify(Array.from(subjects.entries())));
      localStorage.setItem('theme', theme);
      localStorage.setItem('stats', JSON.stringify(studyStats));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
      showNotification('Storage limit may have been exceeded. Consider removing some large files.', 'error');
    }
  };

  const loadFromStorage = () => {
    try {
      const data = localStorage.getItem('sop-subjects');
      if (data) {
        const entries = JSON.parse(data);
        const loadedSubjects = new Map(entries);
        setSubjects(loadedSubjects);
        if (loadedSubjects.size > 0) {
          setCurrentSubject(loadedSubjects.keys().next().value);
        }
      }
      const statsData = localStorage.getItem('stats');
      if (statsData) {
        setStudyStats(JSON.parse(statsData));
      }
    } catch (e) {
      console.error('Error loading from localStorage:', e);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.dataset.theme = newTheme === 'dark' ? 'dark' : '';
    saveToStorage();
  };

  const addSubject = () => {
    const name = prompt('Enter subject name:');
    if (!name || name.trim() === '') return;
    const trimmedName = name.trim();
    if (subjects.has(trimmedName)) {
      showNotification('Subject already exists!', 'error');
      return;
    }
    const newSubjects = new Map(subjects);
    newSubjects.set(trimmedName, {
      name: trimmedName,
      files: [],
      notes: '',
      createdAt: new Date().toISOString(),
      progress: 0,
      color: generateRandomColor(),
    });
    setSubjects(newSubjects);
    saveToStorage();
    showNotification('Subject added successfully!', 'success');
  };

  const deleteSubject = (name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" and all its content?`)) return;
    const newSubjects = new Map(subjects);
    newSubjects.delete(name);
    setSubjects(newSubjects);
    if (currentSubject === name) {
      setCurrentSubject(newSubjects.size > 0 ? newSubjects.keys().next().value : null);
    }
    saveToStorage();
    showNotification('Subject deleted!', 'success');
  };

  const selectSubject = (name) => {
    setCurrentSubject(name);
  };

  const generateRandomColor = () => {
    const colors = [
      '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981',
      '#06B6D4', '#EF4444', '#6366F1', '#F97316', '#14B8A6',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const handleFileUpload = (files) => {
    if (!currentSubject) {
      showNotification('Please select a subject first!', 'warning');
      return;
    }

    const subject = subjects.get(currentSubject);
    const uploadPromises = Array.from(files).map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              id: Date.now() + Math.random(),
              name: file.name,
              type: file.type,
              size: file.size,
              data: e.target.result,
              uploadedAt: new Date().toISOString(),
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    );

    Promise.all(uploadPromises)
      .then((newFiles) => {
        const updatedFiles = [...subject.files, ...newFiles];
        const newSubjects = new Map(subjects);
        newSubjects.set(currentSubject, { ...subject, files: updatedFiles });
        setSubjects(newSubjects);
        saveToStorage();
        updateProgress(currentSubject);
        showNotification(`${files.length} file(s) uploaded!`, 'success');
      })
      .catch((error) => {
        console.error('Error uploading files:', error);
        showNotification('Error uploading files!', 'error');
      });
  };

  const deleteFile = (fileId) => {
    if (!window.confirm('Delete this file?')) return;
    const subject = subjects.get(currentSubject);
    const newFiles = subject.files.filter((f) => f.id !== fileId);
    const newSubjects = new Map(subjects);
    newSubjects.set(currentSubject, { ...subject, files: newFiles });
    setSubjects(newSubjects);
    saveToStorage();
    updateProgress(currentSubject);
    showNotification('File deleted!', 'success');
  };

  const startTimer = () => {
    setIsRunning(true);
  };

  const pauseTimer = () => {
    setIsRunning(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    const mode = timerModes.find((m) => m.mode === currentMode);
    setTimeLeft(mode.time * 60);
  };

  const setTimerMode = (mode) => {
    setCurrentMode(mode.mode);
    setTimeLeft(mode.time * 60);
    setIsRunning(false);
  };

  const handleTimerComplete = () => {
    setIsRunning(false);
    const newStats = { ...studyStats, sessionsCompleted: studyStats.sessionsCompleted + 1 };
    setStudyStats(newStats);
    const message = currentMode === 'focus' ? 'Great work! Time for a break!' : 'Break over! Ready to focus?';
    showNotification(message, 'success');
  };

  const saveNotes = (content) => {
    if (!currentSubject) return;
    const subject = subjects.get(currentSubject);
    const newSubjects = new Map(subjects);
    newSubjects.set(currentSubject, { ...subject, notes: content });
    setSubjects(newSubjects);
    setNotesContent(content);
    saveToStorage();
    updateProgress(currentSubject);
  };

  const executeCommand = (command) => {
    if (command === 'createLink') {
      const url = prompt('Enter the URL');
      if (url) document.execCommand(command, false, url);
    } else if (command === 'removeFormat') {
      document.execCommand('removeFormat');
    } else {
      document.execCommand(command, false, null);
    }
    const editor = document.getElementById('notesEditor');
    if (editor) editor.focus();
  };

  const updateProgress = (subj) => {
    const subject = subjects.get(subj);
    if (!subject) return;
    const notesLength = subject.notes?.trim().length || 0;
    const filesCount = subject.files.length;
    let completion = 0;
    if (notesLength > 200 && filesCount > 0) completion = 100;
    else if (notesLength > 100 || filesCount > 3) completion = 75;
    else if (notesLength > 50 || filesCount > 1) completion = 50;
    else if (notesLength > 0 || filesCount > 0) completion = 25;
    const newSubjects = new Map(subjects);
    newSubjects.set(subj, { ...subject, progress: completion });
    setSubjects(newSubjects);
  };

  const getProgress = () => {
    if (!currentSubject) return 0;
    return subjects.get(currentSubject)?.progress || 0;
  };

  const getTotalProgress = () => {
    if (subjects.size === 0) return 0;
    const total = Array.from(subjects.values()).reduce((sum, s) => sum + (s.progress || 0), 0);
    return Math.round(total / subjects.size);
  };

  const showNotification = (message, type) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3000);
  };

  const filteredSubjects = Array.from(subjects.keys()).filter((name) =>
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
      pdf: 'https://cdn-icons-png.flaticon.com/128/337/337946.png',
      doc: 'https://cdn-icons-png.flaticon.com/128/281/281760.png',
      docx: 'https://cdn-icons-png.flaticon.com/128/281/281760.png',
      jpg: 'https://cdn-icons-png.flaticon.com/128/136/136524.png',
      jpeg: 'https://cdn-icons-png.flaticon.com/128/136/136524.png',
      png: 'https://cdn-icons-png.flaticon.com/128/136/136523.png',
      gif: 'https://cdn-icons-png.flaticon.com/128/136/136523.png',
      mp4: 'https://cdn-icons-png.flaticon.com/128/1684/1684259.png',
      mov: 'https://cdn-icons-png.flaticon.com/128/1684/1684259.png',
      avi: 'https://cdn-icons-png.flaticon.com/128/1684/1684259.png',
      txt: 'https://cdn-icons-png.flaticon.com/128/136/136538.png',
      pptx: 'https://cdn-icons-png.flaticon.com/128/732/732224.png',
      xlsx: 'https://cdn-icons-png.flaticon.com/128/732/732220.png',
    };
    return icons[ext] || 'https://cdn-icons-png.flaticon.com/128/833/833524.png';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const sortedFiles = currentSubject
    ? [...(subjects.get(currentSubject)?.files || [])].sort((a, b) => {
        if (sortBy === 'date') return new Date(b.uploadedAt) - new Date(a.uploadedAt);
        if (sortBy === 'size') return b.size - a.size;
        return a.name.localeCompare(b.name);
      })
    : [];

  return (
    <div className="app">
      <header className="header">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle Menu">
          <i className={`fas fa-${sidebarOpen ? 'bars' : 'xmark'}`}></i>
        </button>
        <a href="#" className="logo">
          <i className="fas fa-graduation-cap"></i>
          <span>Study Organizer</span>
        </a>
        <div className="header-actions">
          <button className="focus-mode-btn" onClick={() => setFocusMode(!focusMode)} title="Focus Mode">
            <i className={`fas ${focusMode ? 'fa-eye-slash' : 'fa-eye'}`}></i>
          </button>
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
            <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
          </button>
        </div>
      </header>

      <div className={`container ${focusMode ? 'focus-mode' : ''}`}>
        {!focusMode && (
          <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
            <div className="search-container">
              <input
                type="text"
                className="search-input"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <i className="fas fa-search search-icon"></i>
            </div>

            <div className="stats-card">
              <div className="stat-item">
                <span className="stat-value">{subjects.size}</span>
                <span className="stat-label">Subjects</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{studyStats.sessionsCompleted}</span>
                <span className="stat-label">Sessions</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{getTotalProgress()}%</span>
                <span className="stat-label">Progress</span>
              </div>
            </div>

            <h2 className="section-title">
              <i className="fas fa-book"></i>
              Subjects
            </h2>
            <ul className="subject-list">
              {filteredSubjects.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-book-open"></i>
                  <h3>No subjects yet</h3>
                  <p>Add your first subject to get started</p>
                </div>
              ) : (
                filteredSubjects.map((name) => (
                  <li
                    key={name}
                    className={`subject-item ${currentSubject === name ? 'active' : ''}`}
                    onClick={() => selectSubject(name)}
                    style={{ '--subject-color': subjects.get(name)?.color }}
                  >
                    <div className="subject-content">
                      <span className="subject-name">{name}</span>
                      <div className="subject-progress-mini">
                        <div className="progress-fill-mini" style={{ width: `${subjects.get(name)?.progress}%` }}></div>
                      </div>
                    </div>
                    <button
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSubject(name);
                      }}
                      title="Delete"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </li>
                ))
              )}
            </ul>

            <button className="btn btn-primary" style={{ width: '100%' }} onClick={addSubject}>
              <i className="fas fa-plus"></i>
              Add Subject
            </button>

            <div className="progress-container">
              <h3 className="section-title">
                <i className="fas fa-chart-line"></i>
                Overall Progress
              </h3>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${getTotalProgress()}%` }}></div>
              </div>
              <div className="progress-text">{getTotalProgress()}% Complete</div>
            </div>
          </aside>
        )}

        <main className={`main-content ${focusMode ? 'full-width' : ''}`}>
          <div className="card timer-container">
            <h2 className="section-title">
              <i className="fas fa-clock"></i>
              Focus Timer
            </h2>
            <div className={`timer-display ${isRunning ? 'running' : ''}`}>{formatTime()}</div>
            <div className="timer-controls">
              <button className="btn btn-primary" onClick={startTimer} disabled={isRunning}>
                <i className="fas fa-play"></i>
                Start
              </button>
              <button className="btn btn-secondary" onClick={pauseTimer} disabled={!isRunning}>
                <i className="fas fa-pause"></i>
                Pause
              </button>
              <button className="btn btn-secondary" onClick={resetTimer}>
                <i className="fas fa-redo"></i>
                Reset
              </button>
            </div>
            <div className="timer-modes">
              {timerModes.map((mode) => (
                <button
                  key={mode.mode}
                  className={`mode-btn ${currentMode === mode.mode ? 'active' : ''}`}
                  onClick={() => setTimerMode(mode)}
                >
                  {mode.name}
                </button>
              ))}
            </div>
          </div>

          <div className="card file-section">
            <div className="file-section-header">
              <h2 className="section-title">
                <i className="fas fa-folder"></i>
                {currentSubject ? `${currentSubject}` : 'Study Materials'}
              </h2>
              <div className="file-controls">
                <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="date">Sort by Date</option>
                  <option value="size">Sort by Size</option>
                  <option value="name">Sort by Name</option>
                </select>
                <button className="view-toggle" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} title="Toggle View">
                  <i className={`fas fa-${viewMode === 'grid' ? 'list' : 'grip'}`}></i>
                </button>
              </div>
            </div>

            <div
              className="file-dropzone"
              onClick={() => {
                if (currentSubject) {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.onchange = (e) => handleFileUpload(e.target.files);
                  input.click();
                } else {
                  showNotification('Please select a subject first!', 'warning');
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('dragover');
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('dragover');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('dragover');
                handleFileUpload(e.dataTransfer.files);
              }}
            >
              <div className="dropzone-content">
                <i className="fas fa-cloud-upload-alt dropzone-icon"></i>
                <div>
                  <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>Drop files here or click to upload</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                    PDF, Images, Videos, Documents supported
                  </p>
                </div>
              </div>
            </div>

            <div className={`file-grid ${viewMode}`}>
              {!currentSubject ? (
                <div className="empty-state">
                  <i className="fas fa-folder-open"></i>
                  <h3>Select a subject</h3>
                  <p>Choose a subject to view and manage files</p>
                </div>
              ) : sortedFiles.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-file-plus"></i>
                  <h3>No files yet</h3>
                  <p>Upload your study materials to get started</p>
                </div>
              ) : (
                sortedFiles.map((file) => (
                  <div key={file.id} className={`file-card ${viewMode}`}>
                    <img src={getFileIcon(file.name)} alt={file.name} className="file-thumbnail" />
                    <div className="file-info">
                      <div className="file-name">{file.name}</div>
                      <div className="file-meta">
                        {formatFileSize(file.size)} • {formatDate(file.uploadedAt)}
                      </div>
                    </div>
                    <div className="file-actions">
                      <a
                        href={file.data}
                        download={file.name}
                        className="file-action download"
                        title="Download"
                      >
                        <i className="fas fa-download"></i>
                      </a>
                      <button
                        className="file-action delete"
                        onClick={() => deleteFile(file.id)}
                        title="Delete"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card notes-section">
            <h2 className="section-title">
              <i className="fas fa-edit"></i>
              Notes
            </h2>
            <div className="editor-toolbar">
              <button className="editor-btn" onClick={() => executeCommand('bold')} title="Bold">
                <i className="fas fa-bold"></i>
              </button>
              <button className="editor-btn" onClick={() => executeCommand('italic')} title="Italic">
                <i className="fas fa-italic"></i>
              </button>
              <button className="editor-btn" onClick={() => executeCommand('underline')} title="Underline">
                <i className="fas fa-underline"></i>
              </button>
              <div className="toolbar-divider"></div>
              <button
                className="editor-btn"
                onClick={() => executeCommand('insertUnorderedList')}
                title="Bullet List"
              >
                <i className="fas fa-list-ul"></i>
              </button>
              <button
                className="editor-btn"
                onClick={() => executeCommand('insertOrderedList')}
                title="Numbered List"
              >
                <i className="fas fa-list-ol"></i>
              </button>
              <button className="editor-btn" onClick={() => executeCommand('createLink')} title="Insert Link">
                <i className="fas fa-link"></i>
              </button>
              <div className="toolbar-divider"></div>
              <button className="editor-btn" onClick={() => executeCommand('removeFormat')} title="Clear Formatting">
                <i className="fas fa-remove-format"></i>
              </button>
            </div>
            <div
              className="notes-editor"
              contentEditable="true"
              id="notesEditor"
              onInput={(e) => saveNotes(e.currentTarget.innerHTML)}
              dangerouslySetInnerHTML={{ __html: notesContent }}
            ></div>
          </div>
        </main>
      </div>

      <div id="notification-container">
        {notifications.map((notif) => (
          <div key={notif.id} className={`notification ${notif.type} show`}>
            <div className="notification-icon">
              <i
                className={`fas fa-${
                  notif.type === 'success'
                    ? 'check-circle'
                    : notif.type === 'error'
                      ? 'exclamation-circle'
                      : 'info-circle'
                }`}
              ></i>
            </div>
            <span>{notif.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;