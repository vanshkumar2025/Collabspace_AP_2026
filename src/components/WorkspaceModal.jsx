import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, api } from '../context/AuthContext';
import './workspace-modal.css';

const tabs = ['Overview', 'Tasks', 'Chat', 'Team', 'Ratings'];

export default function WorkspaceModal({ open, onClose, initialMode = 'register' }) {
  const navigate = useNavigate();
  const { user, setUser, logout, login, register } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [workspaces, setWorkspaces] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [workspaceInvitations, setWorkspaceInvitations] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [summary, setSummary] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    const [{ workspaces: teams }, { invitations: pending }] = await Promise.all([
      api('/api/workspaces'),
      api('/api/invitations'),
    ]);
    setWorkspaces(teams);
    setInvitations(pending);
  }, []);

  const openWorkspace = useCallback(async (workspace) => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const [overview, taskResult, messageResult, memberResult, ratingResult, inviteResult] = await Promise.all([
        api(`/api/workspaces/${workspace.id}/summary`),
        api(`/api/workspaces/${workspace.id}/tasks`),
        api(`/api/workspaces/${workspace.id}/messages`),
        api(`/api/workspaces/${workspace.id}/members`),
        api(`/api/workspaces/${workspace.id}/ratings`),
        api(`/api/workspaces/${workspace.id}/invitations`),
      ]);
      setSelectedWorkspace(overview.workspace);
      setSummary(overview);
      setTasks(taskResult.tasks);
      setMessages(messageResult.messages);
      setMembers(memberResult.members);
      setRatings(ratingResult.ratings);
      setWorkspaceInvitations(inviteResult.invitations);
      setActiveTab('Overview');
      setShowArchived(false);
      setSuggestion(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshWorkspace = useCallback(async () => {
    if (!selectedWorkspace) return;
    const [overview, taskResult] = await Promise.all([
      api(`/api/workspaces/${selectedWorkspace.id}/summary`),
      api(`/api/workspaces/${selectedWorkspace.id}/tasks`),
    ]);
    setSummary(overview);
    setTasks(taskResult.tasks);
  }, [selectedWorkspace]);

  useEffect(() => {
    if (!open) return undefined;
    setMode(initialMode);
    setError('');
    setNotice('');
    setSelectedWorkspace(null);
    api('/api/auth/me')
      .then(async ({ user: signedInUser }) => {
        setUser(signedInUser);
        await loadWorkspaces();
      })
      .catch((requestError) => {
        if (requestError.message === 'Please sign in to continue.' || requestError.message === 'Your session is no longer valid.') {
          setUser(null);
          setWorkspaces([]);
          setInvitations([]);
        } else {
          setError(requestError.message);
        }
      });
    return undefined;
  }, [open, initialMode, loadWorkspaces]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !selectedWorkspace || !['Overview', 'Tasks', 'Chat'].includes(activeTab)) return undefined;
    const timer = window.setInterval(async () => {
      try {
        if (activeTab === 'Chat') {
          const result = await api(`/api/workspaces/${selectedWorkspace.id}/messages`);
          setMessages(result.messages);
        } else {
          const [overview, taskResult] = await Promise.all([
            api(`/api/workspaces/${selectedWorkspace.id}/summary`),
            api(`/api/workspaces/${selectedWorkspace.id}/tasks`),
          ]);
          setSummary(overview);
          setTasks(taskResult.tasks);
        }
      } catch {
        // Keep the current view visible during brief connection interruptions.
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [open, selectedWorkspace, activeTab]);

  if (!open) return null;

  async function handleAuth(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      if (mode === 'register') {
        await register(body);
      } else {
        await login(body.email, body.password);
      }
      onClose();
      navigate('/home');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    setError('');
    setBusy(true);
    try {
      const result = await api('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(body) });
      setUser(result.user);
      await loadWorkspaces();
      setNotice('Profile saved. Assignment suggestions use your skills and focus areas.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateWorkspace(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    try {
      await api('/api/workspaces', { method: 'POST', body: JSON.stringify(body) });
      await loadWorkspaces();
      form.reset();
      setNotice('Workspace created. You are its team lead.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleWorkspaceUpdate(event) {
    event.preventDefault();
    if (!selectedWorkspace) return;
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    setError('');
    setBusy(true);
    try {
      const { workspace } = await api(`/api/workspaces/${selectedWorkspace.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setSelectedWorkspace(workspace);
      await loadWorkspaces();
      const overview = await api(`/api/workspaces/${workspace.id}/summary`);
      setSummary(overview);
      setNotice('Workspace details saved.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateTask(event) {
    event.preventDefault();
    if (!selectedWorkspace) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form).entries());
    setError('');
    setBusy(true);
    try {
      await api(`/api/workspaces/${selectedWorkspace.id}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ ...fields, assigneeIds }),
      });
      await refreshWorkspace();
      form.reset();
      setAssigneeIds([]);
      setSuggestion(null);
      setNotice('Task added to the board.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTaskUpdate(taskId, changes) {
    if (!selectedWorkspace) return;
    setError('');
    try {
      const { task } = await api(`/api/workspaces/${selectedWorkspace.id}/tasks/${taskId}`, {
        method: 'PATCH', body: JSON.stringify(changes),
      });
      setTasks((current) => current.map((item) => item.id === taskId ? task : item));
      await refreshWorkspace();
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleDeleteTask(taskId) {
    if (!selectedWorkspace || !window.confirm('Delete this task and its comments?')) return;
    setError('');
    try {
      await api(`/api/workspaces/${selectedWorkspace.id}/tasks/${taskId}`, { method: 'DELETE' });
      await refreshWorkspace();
      setNotice('Task deleted.');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    if (!selectedWorkspace) return;
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    setError('');
    try {
      await api(`/api/workspaces/${selectedWorkspace.id}/messages`, { method: 'POST', body: JSON.stringify(body) });
      const result = await api(`/api/workspaces/${selectedWorkspace.id}/messages`);
      setMessages(result.messages);
      form.reset();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleInvite(event) {
    event.preventDefault();
    if (!selectedWorkspace) return;
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    setError('');
    setBusy(true);
    try {
      await api(`/api/workspaces/${selectedWorkspace.id}/invitations`, { method: 'POST', body: JSON.stringify(body) });
      form.reset();
      const { invitations: pending } = await api(`/api/workspaces/${selectedWorkspace.id}/invitations`);
      setWorkspaceInvitations(pending);
      setNotice('Invitation added. The teammate will see it when they log in.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelInvitation(invitationId) {
    if (!selectedWorkspace) return;
    setError('');
    try {
      await api(`/api/workspaces/${selectedWorkspace.id}/invitations/${invitationId}`, { method: 'DELETE' });
      setWorkspaceInvitations((current) => current.filter((invitation) => invitation.id !== invitationId));
      setNotice('Invitation cancelled.');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleInvitation(invitationId, accept) {
    setError('');
    try {
      if (accept) {
        await api(`/api/invitations/${invitationId}/accept`, { method: 'POST' });
        setNotice('You joined the workspace.');
      } else {
        await api(`/api/invitations/${invitationId}`, { method: 'DELETE' });
      }
      await loadWorkspaces();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleRating(event) {
    event.preventDefault();
    if (!selectedWorkspace) return;
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    setError('');
    setBusy(true);
    try {
      await api(`/api/workspaces/${selectedWorkspace.id}/ratings`, { method: 'POST', body: JSON.stringify(body) });
      const result = await api(`/api/workspaces/${selectedWorkspace.id}/ratings`);
      setRatings(result.ratings);
      form.reset();
      setNotice('Your rating was saved.');
      const overview = await api(`/api/workspaces/${selectedWorkspace.id}/summary`);
      setSummary(overview);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSuggestion(event) {
    event.preventDefault();
    const form = event.currentTarget.form;
    const title = form?.elements.namedItem('title')?.value || '';
    const description = form?.elements.namedItem('description')?.value || '';
    if (!selectedWorkspace) return;
    setError('');
    try {
      const result = await api(`/api/workspaces/${selectedWorkspace.id}/suggested-assignee?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`);
      if (!result.suggestion) return setNotice('Add teammates before asking for an assignment suggestion.');
      setSuggestion(result.suggestion);
      setAssigneeIds([result.suggestion.userId]);
      setNotice(`Suggested ${result.suggestion.name}: ${result.suggestion.matchedSkills.length ? `skill match for ${result.suggestion.matchedSkills.join(', ')}` : 'currently has the lightest active workload'}.`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleLogout() {
    await logout();
    setWorkspaces([]);
    setInvitations([]);
    setSelectedWorkspace(null);
    setMode('login');
  }

  const myMembership = members.find((member) => member.userId === user?.id);
  const isLead = myMembership?.role === 'Lead' || selectedWorkspace?.createdById === user?.id;
  const myRatingByUser = new Map(ratings.filter((rating) => rating.raterId === user?.id).map((rating) => [rating.ratedUserId, rating]));

  return (
    <div className="workspace-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`workspace-modal${selectedWorkspace ? ' workspace-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="workspace-modal-title">
        <header className="workspace-modal-header">
          <div>
            <span className="workspace-eyebrow">COLLABSPACE WORKSPACE</span>
            <h2 id="workspace-modal-title">{selectedWorkspace ? selectedWorkspace.name : user ? 'Your workspaces' : mode === 'register' ? 'Get started' : 'Welcome back'}</h2>
          </div>
          <button className="workspace-close" type="button" onClick={onClose} aria-label="Close">×</button>
        </header>

        {error && <p className="workspace-alert" role="alert">{error}</p>}
        {notice && <p className="workspace-notice" role="status">{notice}</p>}
        {busy && <p className="workspace-loading" aria-live="polite">Saving your changes…</p>}

        {!user ? (
          <>
            <div className="workspace-tabs" role="tablist" aria-label="Account actions">
              <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Create account</button>
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Log in</button>
            </div>
            <form className="workspace-form" onSubmit={handleAuth}>
              {mode === 'register' && <label>Your name<input name="name" autoComplete="name" required minLength={2} maxLength={80} /></label>}
              <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
              <label>Password<input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={mode === 'register' ? 10 : 1} maxLength={128} /></label>
              {mode === 'register' && <span className="workspace-hint">Use at least 10 characters.</span>}
              <button className="btn btn-primary workspace-submit" type="submit" disabled={busy}>{mode === 'register' ? 'Create your account' : 'Log in'} →</button>
            </form>
          </>
        ) : selectedWorkspace ? (
          <div className="workspace-detail">
            <div className="workspace-detail-top">
              <div>
                <p className="workspace-subtitle">{selectedWorkspace.projectTitle || 'Team workspace'}</p>
                <span>{selectedWorkspace.deadline ? (summary?.workspace.daysRemaining < 0 ? `${Math.abs(summary.workspace.daysRemaining)} days past deadline` : `${summary.workspace.daysRemaining} days until deadline`) : 'No deadline set'}</span>
              </div>
              <div className="workspace-detail-actions">
                <button type="button" className="workspace-text-button" onClick={() => { setSelectedWorkspace(null); loadWorkspaces(); }}>← All workspaces</button>
              </div>
            </div>
            <nav className="workspace-app-tabs" aria-label="Workspace sections">
              {tabs.map((tab) => <button key={tab} type="button" className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}
            </nav>

            {activeTab === 'Overview' && summary && (
              <section className="workspace-overview">
                {isLead && <details className="workspace-profile-settings workspace-settings"><summary>Edit workspace details</summary><form className="workspace-form-grid" onSubmit={handleWorkspaceUpdate}><label>Workspace name<input name="name" defaultValue={selectedWorkspace.name} required minLength={2} maxLength={100} /></label><label>Project title<input name="projectTitle" defaultValue={selectedWorkspace.projectTitle} maxLength={160} /></label><label>Deadline<input name="deadline" type="date" defaultValue={selectedWorkspace.deadline} /></label><button className="btn btn-secondary" type="submit" disabled={busy}>Save workspace</button></form></details>}
                <div className="workspace-metrics">
                  <article><strong>{summary.tasks.total}</strong><span>Total tasks</span></article>
                  <article><strong>{summary.tasks.inProgress}</strong><span>In progress</span></article>
                  <article><strong>{summary.tasks.done}</strong><span>Completed</span></article>
                  <article className={summary.tasks.overdue ? 'attention' : ''}><strong>{summary.tasks.overdue}</strong><span>Overdue</span></article>
                </div>
                <div className="workspace-overview-grid">
                  <section className="workspace-panel">
                    <div className="workspace-panel-heading"><h3>Progress</h3><span>{summary.tasks.total ? Math.round((summary.tasks.done / summary.tasks.total) * 100) : 0}% complete</span></div>
                    <div className="workspace-progress"><span style={{ width: `${summary.tasks.total ? (summary.tasks.done / summary.tasks.total) * 100 : 0}%` }} /></div>
                    <div className="workspace-status-legend"><span>To do {summary.tasks.todo}</span><span>In progress {summary.tasks.inProgress}</span><span>Done {summary.tasks.done}</span></div>
                  </section>
                  <section className="workspace-panel">
                    <div className="workspace-panel-heading"><h3>Contribution</h3><button className="workspace-text-button" type="button" onClick={() => setActiveTab('Team')}>View team</button></div>
                    <ul className="workspace-contribution-list">
                      {summary.members.slice().sort((a, b) => b.completedTasks - a.completedTasks).map((member) => (
                        <li key={member.id}><span>{member.name}</span><strong>{member.completedTasks} done</strong><small>{member.activeTasks} active</small></li>
                      ))}
                    </ul>
                  </section>
                </div>
              </section>
            )}

            {activeTab === 'Tasks' && (
              <section className="workspace-tasks-view">
                <div className="workspace-task-view-heading"><p>{showArchived ? 'Archived tasks' : 'Active task board'}</p><button className="workspace-text-button" type="button" onClick={() => setShowArchived((value) => !value)}>{showArchived ? '← Active tasks' : `View archived (${summary?.tasks.archived || 0})`}</button></div>
                {!showArchived && <>
                <form className="workspace-create-form" onSubmit={handleCreateTask}>
                  <h3>Add a task</h3>
                  <div className="workspace-form-grid workspace-task-fields">
                    <label>Task title<input name="title" required maxLength={200} placeholder="What needs to get done?" /></label>
                    <label>Deadline<input name="deadline" type="date" /></label>
                    <label>Description<input name="description" maxLength={5000} placeholder="Details (optional)" /></label>
                    <label>Priority<select name="priority" defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
                    <label>Status<select name="status" defaultValue="To Do"><option>To Do</option><option>In Progress</option><option>Done</option></select></label>
                    <label>Assignees<select multiple value={assigneeIds} onChange={(event) => setAssigneeIds([...event.target.selectedOptions].map((option) => option.value))}>{members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></label>
                  </div>
                  <div className="workspace-form-actions">
                    <button className="workspace-secondary-button" type="button" onClick={handleSuggestion}>Suggest assignee</button>
                    {suggestion && <span className="workspace-hint">{suggestion.name} · {suggestion.activeTasks} active</span>}
                    <button className="btn btn-primary" type="submit" disabled={busy}>Add task →</button>
                  </div>
                </form>
                </>}
                <div className="workspace-task-board">
                  {['To Do', 'In Progress', 'Done'].map((status) => (
                    <section className="workspace-task-lane" key={status}>
                      <h3>{status}<span>{tasks.filter((task) => task.status === status && Boolean(task.archivedAt) === showArchived).length}</span></h3>
                      {tasks.filter((task) => task.status === status && Boolean(task.archivedAt) === showArchived).map((task) => (
                        <article className="workspace-task-card" key={task.id}>
                          <div className="workspace-task-card-title"><strong>{task.title}</strong><span className={`priority-${task.priority}`}>{task.priority}</span></div>
                          {task.description && <p>{task.description}</p>}
                          {!showArchived && <form className="workspace-task-edit-form" onSubmit={(event) => {
                            event.preventDefault();
                            const form = event.currentTarget;
                            const body = Object.fromEntries(new FormData(form).entries());
                            handleTaskUpdate(task.id, body).then((saved) => { if (saved) setNotice('Task details saved.'); });
                          }}>
                            <input name="title" aria-label="Task title" defaultValue={task.title} required maxLength={200} />
                            <input name="description" aria-label="Task description" defaultValue={task.description} maxLength={5000} placeholder="Description" />
                            <div><input name="deadline" aria-label="Task deadline" type="date" defaultValue={task.deadline} /><select name="priority" aria-label="Task priority" defaultValue={task.priority}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
                            <button type="submit">Save details</button>
                          </form>}
                          <div className="workspace-task-meta">
                            {!showArchived && <label>Status<select value={task.status} onChange={(event) => handleTaskUpdate(task.id, { status: event.target.value })}><option>To Do</option><option>In Progress</option><option>Done</option></select></label>}
                            <label>Assignees<select multiple value={task.assignees.map((assignee) => assignee.userId)} onChange={(event) => handleTaskUpdate(task.id, { assigneeIds: [...event.target.selectedOptions].map((option) => option.value) })}>{members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></label>
                          </div>
                          {task.deadline && <small className="workspace-task-deadline">Due {task.deadline}</small>}
                          {task.assignees.length > 0 && <small>Assigned to {task.assignees.map(({ name }) => name).join(', ')}</small>}
                          {Array.isArray(task.comments) && task.comments.length > 0 && <ul className="workspace-task-comments">{task.comments.slice(-3).map((comment) => <li key={comment.id}><strong>{comment.userName}</strong> {comment.text}</li>)}</ul>}
                          {!showArchived && <form className="workspace-inline-form" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const comment = new FormData(form).get('comment'); handleTaskUpdate(task.id, { comment }).then((saved) => { if (saved) form.reset(); }); }}>
                            <input name="comment" aria-label="Add a comment" placeholder="Add a comment…" maxLength={2000} required />
                            <button type="submit">Comment</button>
                          </form>}
                          <button className="workspace-secondary-button" type="button" onClick={() => handleTaskUpdate(task.id, { archived: !task.archivedAt })}>{task.archivedAt ? 'Restore task' : 'Archive task'}</button>
                          {(task.createdById === user.id || isLead) && <button className="workspace-danger-button" type="button" onClick={() => handleDeleteTask(task.id)}>Delete task</button>}
                        </article>
                      ))}
                      {!tasks.some((task) => task.status === status && Boolean(task.archivedAt) === showArchived) && <p className="workspace-empty">No tasks here.</p>}
                    </section>
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'Chat' && (
              <section className="workspace-chat-view">
                <ul className="workspace-list workspace-messages workspace-chat-history">
                  {messages.map((message) => <li key={message.id}><strong>{message.userName} <small>{new Date(message.createdAt).toLocaleString()}</small></strong><span>{message.text}</span></li>)}
                  {!messages.length && <li className="workspace-empty">Start the team conversation.</li>}
                </ul>
                <form className="workspace-inline-form" onSubmit={handleSendMessage}>
                  <input name="text" aria-label="Message" placeholder="Write a message…" required maxLength={4000} />
                  <button type="submit">Send</button>
                </form>
              </section>
            )}

            {activeTab === 'Team' && (
              <section className="workspace-team-view">
                {isLead && <form className="workspace-invite-form" onSubmit={handleInvite}><div><h3>Invite a teammate</h3><p>They need an existing CollabSpace account to receive an in-app invitation.</p></div><input type="email" name="email" aria-label="Teammate email" placeholder="teammate@example.com" required /><button className="btn btn-primary" type="submit" disabled={busy}>Invite</button></form>}
                {isLead && workspaceInvitations.length > 0 && <div className="workspace-pending-invites"><h3>Pending invitations</h3>{workspaceInvitations.map((invitation) => <article key={invitation.id}><div><strong>{invitation.name}</strong><span>{invitation.email} · invited by {invitation.invitedBy}</span></div><button type="button" onClick={() => handleCancelInvitation(invitation.id)}>Cancel</button></article>)}</div>}
                <div className="workspace-member-grid">
                  {members.map((member) => <article className="workspace-member-card" key={member.userId}><div className="workspace-avatar">{member.name.slice(0, 1).toUpperCase()}</div><div><strong>{member.name}</strong><span>{member.email}</span><small>{member.role}</small></div><div className="workspace-member-stats"><b>{member.completedTasks}</b><span>done</span><b>{member.averageRating ?? '—'}</b><span>rating</span></div></article>)}
                  {!members.length && <p className="workspace-empty">No members found.</p>}
                </div>
              </section>
            )}

            {activeTab === 'Ratings' && (
              <section className="workspace-ratings-view">
                <form className="workspace-rating-form" onSubmit={handleRating}>
                  <h3>Rate a teammate</h3>
                  <div className="workspace-form-grid">
                    <label>Teammate<select name="ratedUserId" required defaultValue=""><option value="" disabled>Select a member</option>{members.filter((member) => member.userId !== user.id).map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></label>
                    <label>Score<select name="score" defaultValue="5"><option value="5">5 · Excellent</option><option value="4">4 · Strong</option><option value="3">3 · Good</option><option value="2">2 · Needs improvement</option><option value="1">1 · Poor</option></select></label>
                    <label className="workspace-rating-feedback">Feedback<textarea name="feedback" maxLength={2000} placeholder="Share constructive feedback (optional)" /></label>
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={busy || members.length < 2}>Save rating</button>
                </form>
                <h3 className="workspace-section-title">Team feedback <span>{ratings.length}</span></h3>
                <div className="workspace-rating-list">
                  {ratings.map((rating) => <article key={rating.id}><div><strong>{rating.ratedUserName}</strong><span>Rated by {rating.raterName}</span></div><b>{rating.score ?? '—'} / 5</b><p>{rating.feedback || 'No written feedback.'}</p>{myRatingByUser.has(rating.ratedUserId) && rating.raterId === user.id && <small>Your rating</small>}</article>)}
                  {!ratings.length && <p className="workspace-empty">No ratings yet.</p>}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="workspace-dashboard">
            <div className="workspace-user-row">
              <p>Signed in as <strong>{user.name}</strong> <span>{user.email}</span></p>
              <button className="workspace-text-button" type="button" onClick={handleLogout}>Log out</button>
            </div>
            {invitations.length > 0 && <section className="workspace-invitation-inbox"><h3>Invitations <span>{invitations.length}</span></h3>{invitations.map((invitation) => <article key={invitation.id}><div><strong>{invitation.team.name}</strong><span>Invited by {invitation.invitedBy}</span></div><button type="button" onClick={() => handleInvitation(invitation.id, false)}>Decline</button><button className="btn btn-primary" type="button" onClick={() => handleInvitation(invitation.id, true)}>Join team</button></article>)}</section>}
            <details className="workspace-profile-settings">
              <summary>Profile and assignment skills</summary>
              <form className="workspace-form-grid" onSubmit={handleProfile}>
                <label>Name<input name="name" defaultValue={user.name} required minLength={2} maxLength={80} /></label>
                <label>Course<input name="course" defaultValue={user.course || ''} maxLength={120} placeholder="Optional" /></label>
                <label>Year<input name="year" defaultValue={user.year || ''} maxLength={40} placeholder="Optional" /></label>
                <label>Skills<input name="skills" defaultValue={(user.skills || []).join(', ')} maxLength={800} placeholder="Research, design, coding" /></label>
                <label>Work focus<input name="workFocus" defaultValue={(user.workFocus || []).join(', ')} maxLength={800} placeholder="Writing, analysis, presentation" /></label>
                <label>About<input name="about" defaultValue={user.about || ''} maxLength={1000} placeholder="Optional" /></label>
                <button className="btn btn-secondary" type="submit" disabled={busy}>Save profile</button>
              </form>
            </details>
            <form className="workspace-create-form" onSubmit={handleCreateWorkspace}>
              <h3>Create a workspace</h3>
              <div className="workspace-form-grid">
                <label>Workspace name<input name="name" required minLength={2} maxLength={100} placeholder="e.g. Biology Capstone" /></label>
                <label>Project title<input name="projectTitle" maxLength={160} placeholder="Optional" /></label>
                <label>Deadline<input name="deadline" type="date" /></label>
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy}>Create workspace →</button>
            </form>
            <h3 className="workspace-section-title">Your teams <span>{workspaces.length}</span></h3>
            <div className="workspace-cards">
              {workspaces.map((workspace) => <button className="workspace-card" type="button" key={workspace.id} onClick={() => openWorkspace(workspace)}><strong>{workspace.name}</strong><span>{workspace.projectTitle || 'Team workspace'}</span><small>{workspace._count.members} members · {workspace._count.tasks} tasks</small></button>)}
              {!workspaces.length && <p className="workspace-empty">You don’t have a workspace yet. Create one above.</p>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
