// App.js
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

  const handleFileUpload = (files) => {
    if (!currentSubject) {
      showNotification('Please select a subject first!', 'warning');
      return;
    }

    const subject = subjects.get(currentSubject);

    const uploadPromises = Array.from(files).map((file) =>
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
    const message = currentMode === 'focus' ? 'Time for a break!' : 'Time to focus!';
    showNotification(message, 'success');
    // Notification and sound can be added if needed
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
    if (notesLength > 0 && filesCount > 0) completion = 75;
    else if (notesLength > 0 || filesCount > 0) completion = 50;
    const newSubjects = new Map(subjects);
    newSubjects.set(subj, { ...subject, progress: completion });
    setSubjects(newSubjects);
  };

  const getProgress = () => {
    if (!currentSubject) return 0;
    return subjects.get(currentSubject)?.progress || 0;
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

  return (
    <div className="app">
      <header className="header">
        <a href="#" className="logo">
          <i className="fas fa-graduation-cap"></i>
          Study Organizer Pro
        </a>
        <div className="header-actions">
          <button className="theme-toggle tooltip" data-tooltip="Toggle Theme" onClick={toggleTheme}>
            <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
          </button>
        </div>
      </header>
      <div className="container">
        <aside className="sidebar">
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder="Search subjects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <i className="fas fa-search search-icon"></i>
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
                >
                  <span className="subject-name">{name}</span>
                  <div className="subject-actions">
                    <button
                      className="action-btn tooltip"
                      data-tooltip="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSubject(name);
                      }}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
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
              Study Progress
            </h3>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${getProgress()}%` }}></div>
            </div>
            <div className="progress-text">{getProgress()}% Complete</div>
          </div>
        </aside>
        <main className="main-content">
          <div className="card timer-container">
            <h2 className="section-title">
              <i className="fas fa-clock"></i>
              Focus Timer
            </h2>
            <div className="timer-display">{formatTime()}</div>
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
            <h2 className="section-title">
              <i className="fas fa-folder"></i>
              {currentSubject ? `${currentSubject} - Study Materials` : 'Study Materials'}
            </h2>
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
            <div className="file-grid">
              {!currentSubject ? (
                <div className="empty-state">
                  <i className="fas fa-folder-open"></i>
                  <h3>Select a subject</h3>
                  <p>Choose a subject to view and manage files</p>
                </div>
              ) : subjects.get(currentSubject)?.files.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-file-plus"></i>
                  <h3>No files yet</h3>
                  <p>Upload your study materials to get started</p>
                </div>
              ) : (
                subjects.get(currentSubject)?.files.map((file) => (
                  <div key={file.id} className="file-card">
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
                        className="file-action download tooltip"
                        data-tooltip="Download"
                      >
                        <i className="fas fa-download"></i>
                      </a>
                      <button
                        className="file-action delete tooltip"
                        data-tooltip="Delete"
                        onClick={() => deleteFile(file.id)}
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
              <button className="editor-btn tooltip" data-tooltip="Bold" onClick={() => executeCommand('bold')}>
                <i className="fas fa-bold"></i>
              </button>
              <button className="editor-btn tooltip" data-tooltip="Italic" onClick={() => executeCommand('italic')}>
                <i className="fas fa-italic"></i>
              </button>
              <button className="editor-btn tooltip" data-tooltip="Underline" onClick={() => executeCommand('underline')}>
                <i className="fas fa-underline"></i>
              </button>
              <button
                className="editor-btn tooltip"
                data-tooltip="Bullet List"
                onClick={() => executeCommand('insertUnorderedList')}
              >
                <i className="fas fa-list-ul"></i>
              </button>
              <button
                className="editor-btn tooltip"
                data-tooltip="Numbered List"
                onClick={() => executeCommand('insertOrderedList')}
              >
                <i className="fas fa-list-ol"></i>
              </button>
              <button className="editor-btn tooltip" data-tooltip="Insert Link" onClick={() => executeCommand('createLink')}>
                <i className="fas fa-link"></i>
              </button>
              <button
                className="editor-btn tooltip"
                data-tooltip="Clear Formatting"
                onClick={() => executeCommand('removeFormat')}
              >
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
      <div id="notification-container" style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999 }}>
        {notifications.map((notif) => (
          <div key={notif.id} className={`notification ${notif.type} show`}>
            {notif.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;