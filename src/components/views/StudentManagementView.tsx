import React, { useState, useEffect } from 'react';
import { AppScreen, Student, CsvImportResult, Hostel } from '../../types';
import { parseAndValidateStudentCsv } from '../../lib/hostel-service';
import { subscribeToStudents, saveStudentToDb, deleteStudentFromDb, batchImportStudentsToDb, subscribeToHostels } from '../../lib/db-seed';
import { useAuth } from '../../context/AuthContext';
import { createResidentInvitation, regenerateResidentInvitation } from '../../lib/invitation-service';
import { getMockUserForRole } from '../../lib/auth';

export interface StudentManagementViewProps {
  onNavigate: (screen: AppScreen) => void;
  onLogout: () => void;
}

export const StudentManagementView: React.FC<StudentManagementViewProps> = ({
  onNavigate,
  onLogout,
}) => {
  const { user, authorizedHostels } = useAuth();
  const isWarden = user?.role === 'warden';
  const isAdmin = user?.role === 'super_admin';
  const hasAssignedHostel = isAdmin || authorizedHostels.length > 0;

  const [students, setStudents] = useState<Student[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals & Drawers
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Edit Resident State
  const [isEditMode, setIsEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRollNo, setEditRollNo] = useState('');
  const [editRoom, setEditRoom] = useState('');
  const [editHostelId, setEditHostelId] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editGuardianPhone, setEditGuardianPhone] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);

  // Add Student Form State
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentRoll, setNewStudentRoll] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [newStudentRoom, setNewStudentRoom] = useState('101');
  const [newGuardianPhone, setNewGuardianPhone] = useState('');
  const [newStudentHostelId, setNewStudentHostelId] = useState('');

  // CSV Import State
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [csvValidationResult, setCsvValidationResult] = useState<CsvImportResult | null>(null);

  // Setup Link Sharing Dialog
  const [setupLinkDialog, setSetupLinkDialog] = useState<{ studentName: string; setupUrl: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const unsubscribeStudents = subscribeToStudents((liveStudents) => {
      setStudents(liveStudents);
    });

    const unsubscribeHostels = subscribeToHostels((liveHostels) => {
      setHostels(liveHostels);
    });

    return () => {
      unsubscribeStudents();
      unsubscribeHostels();
    };
  }, []);

  // Synchronize newStudentHostelId with authorized hostels
  useEffect(() => {
    if (authorizedHostels.length > 0) {
      if (!newStudentHostelId || !authorizedHostels.some((h) => h.id === newStudentHostelId)) {
        setNewStudentHostelId(authorizedHostels[0].id);
      }
    } else {
      setNewStudentHostelId('');
    }
  }, [authorizedHostels, newStudentHostelId]);

  const downloadCsv = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSampleTemplate = () => {
    const template = [
      'name,rollNo,room,email,phone,semester',
      'Ananya Sharma,#23CSE012,101,ananya.s@herspace.edu,+91 98160 11223,1st Sem',
      'Pooja Verma,#22ECE045,102,pooja.v@herspace.edu,+91 98160 22334,3rd Sem',
      'Riya Sen,#21MEC033,201,riya.s@herspace.edu,+91 98160 33445,5th Sem',
    ].join('\r\n');
    downloadCsv('HER_SPACE_Student_Import_Template.csv', template);
    showToast('Downloaded sample student CSV template.');
  };

  const handleExportRoster = () => {
    const headers = 'Student ID,Name,Roll No,Room,Email,Phone,Guardian Phone,Status,Attendance Status';
    const rows = students.map((s) =>
      [
        s.studentId,
        `"${s.name}"`,
        `"${s.rollNo}"`,
        s.room,
        s.email,
        s.phone,
        s.guardianPhone || '',
        s.status,
        s.attendanceStatus,
      ].join(',')
    );
    const csv = [headers, ...rows].join('\r\n');
    downloadCsv(`HER_SPACE_Student_Roster_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    showToast(`Exported ${students.length} resident records to CSV.`);
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || '');
      const res = parseAndValidateStudentCsv(text, 'HST-HER-01');
      setCsvValidationResult(res);
      showToast(`Parsed CSV: ${res.importedCount} valid records.`);
    };
    reader.readAsText(file);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAssignedHostel) {
      showToast('Action Blocked: No hostel has been assigned to your warden account.');
      return;
    }

    if (!newStudentName || !newStudentRoll || !newStudentEmail) {
      alert('Please fill out all required fields.');
      return;
    }

    const selectedHostelId = newStudentHostelId || (authorizedHostels[0]?.id ?? '');
    if (!selectedHostelId || (isWarden && !authorizedHostels.some((h) => h.id === selectedHostelId))) {
      showToast('Error: Please select a valid hostel assigned to your account.');
      return;
    }

    const created: Student = {
      id: `stu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      studentId: `HER-${100 + students.length + 1}`,
      name: newStudentName.trim(),
      rollNo: newStudentRoll.startsWith('#') ? newStudentRoll : `#${newStudentRoll}`,
      semester: '1st Sem',
      room: newStudentRoom.trim(),
      block: 'HER-SPACE Main',
      floor: 1,
      email: newStudentEmail.trim().toLowerCase(),
      phone: newStudentPhone || '6267549800',
      guardianPhone: newGuardianPhone || '6267549800',
      status: 'active',
      device: 'Registered Mobile',
      browser: 'Chrome Mobile',
      deviceStatus: 'pending',
      attendanceStatus: 'Pending',
      lastUpdated: 'Account Provisioned',
      hostelId: selectedHostelId,
      avatarInitials: newStudentName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
    };

    // Flow: Generate unpredictable single-use setup link via central /api/invite
    let inviteToken = '';
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          role: 'student',
          email: created.email,
          name: created.name,
          hostelId: selectedHostelId,
          roomNumber: created.room,
          residentId: created.studentId,
        }),
      });
      if (res.ok) {
        const invData = await res.json();
        inviteToken = invData.token;
      }
    } catch (invErr) {
      console.warn('[handleSaveStudent] Invitation API error:', invErr);
    }

    const setupUrl = inviteToken
      ? `${window.location.origin}/setup/${inviteToken}`
      : `${window.location.origin}/setup/${created.studentId}`;
    created.setupLink = setupUrl;
    (created as any).inviteToken = inviteToken;
    created.invitationStatus = 'pending';

    try {
      await saveStudentToDb(created);
      setIsAddDrawerOpen(false);
      setNewStudentName('');
      setNewStudentRoll('');
      setNewStudentEmail('');
      setNewStudentPhone('');
      setNewGuardianPhone('');
      showToast(`Added resident: ${created.name} (Room ${created.room})`);
      setSetupLinkDialog({ studentName: created.name, setupUrl });
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(setupUrl).catch(() => {});
      }
    } catch {
      setStudents([created, ...students]);
      setIsAddDrawerOpen(false);
      showToast(`Added resident: ${created.name}`);
      setSetupLinkDialog({ studentName: created.name, setupUrl });
    }
  };

  const handleShareStudentLink = async (stu: Student) => {
    let url = stu.setupLink;
    let token = (stu as any).inviteToken;

    if (!token) {
      try {
        const res = await fetch('/api/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate',
            role: 'student',
            email: stu.email,
            name: stu.name,
            hostelId: stu.hostelId || '',
            roomNumber: stu.room,
            residentId: stu.studentId,
          }),
        });
        if (res.ok) {
          const invData = await res.json();
          token = invData.token;
          url = `${window.location.origin}/setup/${token}`;
          stu.setupLink = url;
          (stu as any).inviteToken = token;
          (stu as any).inviteStatus = 'pending';
          saveStudentToDb(stu);
        }
      } catch (err) {
        console.warn('Invite token generation note:', err);
      }
    }

    const finalUrl = url || `${window.location.origin}/setup/${stu.studentId}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(finalUrl).catch(() => {});
    }
    showToast(`Setup link copied! Share with ${stu.name} to set password.`);
    setSetupLinkDialog({
      studentName: stu.name,
      setupUrl: finalUrl,
    });
  };

  const handleRegenerateLink = async (stu: Student) => {
    const actor = user || getMockUserForRole('warden');
    try {
      const inv = await regenerateResidentInvitation(stu.id, actor);
      const updatedStu: Student = {
        ...stu,
        setupLink: inv.setupUrl,
        invitationStatus: 'pending',
      };
      setStudents((prev) => prev.map((s) => (s.id === stu.id ? updatedStu : s)));
      if (selectedStudent && selectedStudent.id === stu.id) {
        setSelectedStudent(updatedStu);
      }
      setSetupLinkDialog({ studentName: stu.name, setupUrl: inv.setupUrl });
      showToast(`Regenerated single-use setup link for ${stu.name}.`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to regenerate link.');
    }
  };

  const handleBulkImportConfirm = async () => {
    if (csvValidationResult && csvValidationResult.importedStudents.length > 0) {
      try {
        await batchImportStudentsToDb(csvValidationResult.importedStudents);
        setIsCsvModalOpen(false);
        showToast(
          `Imported ${csvValidationResult.importedStudents.length} student records successfully.`
        );
      } catch {
        setStudents((prev) => [...csvValidationResult.importedStudents, ...prev]);
        setIsCsvModalOpen(false);
        showToast(
          `Imported ${csvValidationResult.importedStudents.length} student records.`
        );
      }
    } else {
      setIsCsvModalOpen(false);
    }
  };

  const handleToggleStudentStatus = async (stu: Student) => {
    const updatedStatus: 'active' | 'inactive' = stu.status === 'active' ? 'inactive' : 'active';
    const updated: Student = { ...stu, status: updatedStatus };
    try {
      await saveStudentToDb(updated);
      setSelectedStudent(updated);
      showToast(`Status updated to ${updatedStatus}`);
    } catch {
      setStudents((prev) => prev.map((s) => (s.id === stu.id ? updated : s)));
      setSelectedStudent(updated);
      showToast(`Status updated to ${updatedStatus}`);
    }
  };

  const handleOpenStudentProfile = (stu: Student, edit = false) => {
    setSelectedStudent(stu);
    setEditName(stu.name || '');
    setEditRollNo(stu.rollNo || '');
    setEditRoom(stu.room || '');
    setEditHostelId(stu.hostelId || (authorizedHostels[0]?.id ?? ''));
    setEditEmail(stu.email || '');
    setEditPhone(stu.phone || '');
    setEditGuardianPhone(stu.guardianPhone || '');
    setEditStatus(stu.status || 'active');
    setIsEditMode(edit);
    setIsProfileDrawerOpen(true);
  };

  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    if (!editName.trim() || !editRollNo.trim() || !editEmail.trim()) {
      showToast('Please fill required fields (Name, Roll No, Email).');
      return;
    }

    const targetHostelId = editHostelId || selectedStudent.hostelId || (authorizedHostels[0]?.id ?? '');
    if (isWarden && !authorizedHostels.some((h) => h.id === targetHostelId)) {
      showToast('Error: Selected hostel is not assigned to your account.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const formattedRoll = editRollNo.trim().startsWith('#')
        ? editRollNo.trim()
        : `#${editRollNo.trim()}`;

      const initials = editName
        .trim()
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      const updatedStudent: Student = {
        ...selectedStudent,
        name: editName.trim(),
        rollNo: formattedRoll,
        room: editRoom.trim() || selectedStudent.room,
        hostelId: targetHostelId,
        email: editEmail.trim().toLowerCase(),
        phone: editPhone.trim() || selectedStudent.phone,
        guardianPhone: editGuardianPhone.trim() || selectedStudent.guardianPhone || editPhone.trim(),
        status: editStatus,
        avatarInitials: initials || selectedStudent.avatarInitials,
        lastUpdated: 'Details Updated',
      };

      await saveStudentToDb(updatedStudent);
      setSelectedStudent(updatedStudent);
      setIsEditMode(false);
      showToast(`Updated resident ${updatedStudent.name} successfully!`);
    } catch (err) {
      console.error('Failed to update student:', err);
      showToast('Failed to update resident details.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteStudent = async (stu: Student) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove resident "${stu.name}" (${stu.studentId})?\n\nThis will permanently remove their profile and linked credentials.`
    );
    if (!confirmed) return;

    setIsDeletingStudent(true);
    try {
      await deleteStudentFromDb(stu.id);
      setIsProfileDrawerOpen(false);
      setSelectedStudent(null);
      setIsEditMode(false);
      showToast(`Resident ${stu.name} removed successfully.`);
    } catch (err) {
      console.error('Failed to delete student:', err);
      showToast('Failed to remove resident.');
    } finally {
      setIsDeletingStudent(false);
    }
  };

  // Authorized students isolation:
  // - Admin sees all students
  // - Warden ONLY sees students who belong to their assigned hostels
  // - If warden has no assigned hostels, authorizedStudents is strictly EMPTY []
  const authorizedStudents = students.filter((stu) => {
    if (isAdmin) return true;
    if (isWarden) {
      if (authorizedHostels.length === 0) return false;
      return authorizedHostels.some((h) => h.id === stu.hostelId);
    }
    return false;
  });

  // Synchronize selectedStudent only within authorized students
  useEffect(() => {
    if (authorizedStudents.length > 0) {
      if (!selectedStudent || !authorizedStudents.some((s) => s.id === selectedStudent.id)) {
        setSelectedStudent(authorizedStudents[0]);
      }
    } else if (selectedStudent) {
      setSelectedStudent(null);
    }
  }, [authorizedStudents, selectedStudent]);

  const filteredStudents = authorizedStudents.filter((stu) => {
    const matchesSearch =
      stu.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stu.rollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stu.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stu.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'active'
        ? stu.status === 'active'
        : stu.status === 'inactive';

    return matchesSearch && matchesStatus;
  });

  const totalEnrolled = authorizedStudents.length;
  const activeCount = authorizedStudents.filter((s) => s.status === 'active').length;
  const inactiveCount = authorizedStudents.filter((s) => s.status === 'inactive').length;

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex flex-col pb-24 md:pb-8">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 flex pointer-events-none">
          <div className="bg-slate-800 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs sm:text-sm font-medium border border-violet-500/40">
            <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 space-y-5 sm:space-y-6">
        {/* Page Title & Action Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[22px]">group</span>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-on-surface leading-tight">HER-SPACE Resident Directory</h1>
              <p className="text-xs text-secondary mt-0.5">Manage resident roster, room assignments &amp; setup invitation links</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={!hasAssignedHostel}
              onClick={() => {
                if (!hasAssignedHostel) {
                  showToast('Action Blocked: No hostel has been assigned to your warden account.');
                  return;
                }
                setIsCsvModalOpen(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant/30 text-xs font-semibold transition-colors ${
                !hasAssignedHostel
                  ? 'opacity-40 cursor-not-allowed bg-surface-container-low text-secondary'
                  : 'hover:bg-surface-container text-on-surface cursor-pointer'
              }`}
              title={!hasAssignedHostel ? 'No hostel assigned' : 'Import resident roster via CSV'}
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              <span className="hidden sm:inline">Import CSV</span>
            </button>
            <button
              type="button"
              disabled={!hasAssignedHostel}
              onClick={handleExportRoster}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant/30 text-xs font-semibold transition-colors ${
                !hasAssignedHostel
                  ? 'opacity-40 cursor-not-allowed bg-surface-container-low text-secondary'
                  : 'hover:bg-surface-container text-on-surface cursor-pointer'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              type="button"
              disabled={!hasAssignedHostel}
              onClick={() => {
                if (!hasAssignedHostel) {
                  showToast('Action Blocked: No hostel has been assigned to your warden account.');
                  return;
                }
                setIsAddDrawerOpen(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition-colors ml-auto sm:ml-0 ${
                !hasAssignedHostel
                  ? 'bg-primary/40 text-on-primary/60 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-hover text-on-primary cursor-pointer'
              }`}
              title={!hasAssignedHostel ? 'No hostel assigned' : 'Register new resident'}
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              <span>Register Resident</span>
            </button>
          </div>
        </div>

        {/* Warning banner when warden has no assigned hostel */}
        {!hasAssignedHostel && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-xs">
            <span className="material-symbols-outlined text-amber-500 text-2xl shrink-0">domain_disabled</span>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400">No Residential Hostel Assigned</h3>
              <p className="text-xs text-secondary leading-relaxed">
                Your warden account is currently not assigned to any residential hostel. Until an administrator assigns you to a hostel boundary, you cannot view resident records, monitor attendance, or register new residents.
              </p>
            </div>
          </div>
        )}

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[22px]">group</span>
            </div>
            <div>
              <p className="font-headline-sm font-bold text-on-surface">{totalEnrolled}</p>
              <p className="font-label-xs text-secondary">Total Enrolled</p>
            </div>
          </div>

            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[22px]">check_circle</span>
              </div>
              <div>
                <p className="font-headline-sm font-bold text-emerald-700">{activeCount}</p>
                <p className="font-label-xs text-secondary">Active Residents</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[22px]">person_off</span>
              </div>
              <div>
                <p className="font-headline-sm font-bold text-slate-700">{inactiveCount}</p>
                <p className="font-label-xs text-secondary">Inactive / Alumni</p>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-96">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, roll no, room, or email..."
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl pl-10 pr-4 py-2 font-body-sm text-body-sm text-on-surface placeholder:text-secondary outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {(['all', 'active', 'inactive'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-full text-label-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    filterStatus === status
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface-container-low text-secondary hover:text-on-surface'
                  }`}
                >
                  {status === 'all'
                    ? `All (${totalEnrolled})`
                    : status === 'active'
                    ? `Active (${activeCount})`
                    : `Inactive (${inactiveCount})`}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Resident Card View (< md screens) */}
          <div className="md:hidden space-y-3">
            {filteredStudents.length === 0 ? (
              <div className="py-8 text-center text-secondary text-xs bg-surface-container-low rounded-xl border border-outline-variant/20">
                No students found matching your criteria.
              </div>
            ) : (
              filteredStudents.map((stu) => (
                <div
                  key={stu.id}
                  className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {stu.avatarInitials}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-on-surface leading-tight">{stu.name}</p>
                        <div className="flex items-center gap-2 text-[11px] text-secondary mt-0.5">
                          <span className="font-mono">{stu.rollNo}</span>
                          <span>&bull;</span>
                          <span className="font-semibold text-on-surface">Room {stu.room}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        stu.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          stu.status === 'active' ? 'bg-emerald-600' : 'bg-slate-400'
                        }`}
                      ></span>
                      {stu.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="text-[11px] text-secondary pt-1 border-t border-outline-variant/20 flex flex-col gap-0.5">
                    <span>Email: <strong className="text-on-surface font-normal">{stu.email}</strong></span>
                    <span>Phone: <strong className="text-on-surface font-normal">{stu.phone}</strong></span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/20">
                    <button
                      type="button"
                      onClick={() => handleShareStudentLink(stu)}
                      className="flex-1 py-2 rounded-xl border border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold text-center cursor-pointer transition-colors shadow-xs inline-flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">link</span>
                      <span>Share Link</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenStudentProfile(stu, false)}
                      className="px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold cursor-pointer transition-colors inline-flex items-center gap-1"
                      title="View details"
                    >
                      <span className="material-symbols-outlined text-xs">visibility</span>
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenStudentProfile(stu, true)}
                      className="px-3 py-2 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs font-semibold cursor-pointer transition-colors inline-flex items-center gap-1 shadow-xs"
                      title="Edit resident details"
                    >
                      <span className="material-symbols-outlined text-xs">edit</span>
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Roster Table (>= md screens) */}
          <div className="hidden md:block rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Student Name</th>
                    <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Hostel</th>
                    <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Roll No</th>
                    <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Room</th>
                    <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Contact</th>
                    <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500">Status</th>
                    <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-secondary">
                        No students found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((stu) => (
                      <tr key={stu.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleOpenStudentProfile(stu, false)}
                            className="flex items-center gap-2.5 text-left group cursor-pointer"
                            title="Click to view details"
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                              {stu.avatarInitials}
                            </div>
                            <span className="font-title-sm font-semibold text-on-surface group-hover:text-primary transition-colors">{stu.name}</span>
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface font-label-xs font-semibold border border-outline-variant/30">
                            {hostels.find((h) => h.id === stu.hostelId)?.name || stu.hostelId || 'Unassigned'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-code-sm text-code-sm text-secondary">{stu.rollNo}</td>
                        <td className="py-3 px-4 font-semibold text-on-surface">Room {stu.room}</td>
                        <td className="py-3 px-4">
                          <p className="text-body-sm text-on-surface">{stu.phone}</p>
                          <p className="font-label-xs text-secondary truncate">{stu.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-xs font-semibold ${
                              stu.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                stu.status === 'active' ? 'bg-emerald-600' : 'bg-slate-400'
                              }`}
                            ></span>
                            {stu.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleShareStudentLink(stu)}
                            className="px-2 py-1.5 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 font-label-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs"
                            title="Copy shareable link for student to set password"
                          >
                            <span className="material-symbols-outlined text-xs">link</span>
                            <span>Share</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenStudentProfile(stu, false)}
                            className="px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                            title="View resident details"
                          >
                            <span className="material-symbols-outlined text-xs">visibility</span>
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenStudentProfile(stu, true)}
                            className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-label-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs"
                            title="Edit resident details"
                          >
                            <span className="material-symbols-outlined text-xs">edit</span>
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>


      {/* Add Student Drawer Modal */}
      {isAddDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end"
          onClick={() => setIsAddDrawerOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface-container-lowest h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
                <h3 className="font-title-lg text-title-lg font-bold text-on-surface">Add New Resident</h3>
                <button
                  type="button"
                  onClick={() => setIsAddDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <form onSubmit={handleSaveStudent} className="space-y-4">
                <div>
                  <label className="block font-label-sm font-semibold text-on-surface mb-1">
                    Student Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Sharma"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-label-sm font-semibold text-on-surface mb-1">
                      Roll Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 23CSE011"
                      value={newStudentRoll}
                      onChange={(e) => setNewStudentRoll(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block font-label-sm font-semibold text-on-surface mb-1">
                      Assigned Room *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 101"
                      value={newStudentRoom}
                      onChange={(e) => setNewStudentRoom(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-label-sm font-semibold text-on-surface mb-1">
                    Hostel Jurisdiction *
                  </label>
                  <select
                    required
                    disabled={authorizedHostels.length === 0}
                    value={newStudentHostelId}
                    onChange={(e) => setNewStudentHostelId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary/20 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {authorizedHostels.length === 0 ? (
                      <option value="">No assigned hostels available</option>
                    ) : (
                      <>
                        <option value="">Select Residential Hostel...</option>
                        {authorizedHostels.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.id})
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  {authorizedHostels.length === 0 ? (
                    <p className="text-[11px] text-rose-500 font-semibold mt-1">
                      ⚠️ You cannot register residents because no hostel has been assigned to your warden account yet.
                    </p>
                  ) : (
                    <p className="text-[11px] text-secondary mt-1">
                      Student will be bound to this hostel's boundary and assigned warden.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-label-sm font-semibold text-on-surface mb-1">
                    Student Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="student@herspace.edu"
                    value={newStudentEmail}
                    onChange={(e) => setNewStudentEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-label-sm font-semibold text-on-surface mb-1">
                      Student Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="6267549800"
                      value={newStudentPhone}
                      onChange={(e) => setNewStudentPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block font-label-sm font-semibold text-on-surface mb-1">
                      Parent Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="6267549800"
                      value={newGuardianPhone}
                      onChange={(e) => setNewGuardianPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddDrawerOpen(false)}
                    className="px-4 py-2 rounded-xl border border-outline-variant/30 hover:bg-surface-container text-on-surface font-label-md cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={authorizedHostels.length === 0}
                    className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover disabled:bg-primary/40 disabled:cursor-not-allowed text-on-primary font-label-md font-semibold shadow-xs cursor-pointer"
                  >
                    Save Student
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Student Details & Edit Drawer */}
      {isProfileDrawerOpen && selectedStudent && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end"
          onClick={() => {
            setIsProfileDrawerOpen(false);
            setIsEditMode(false);
          }}
        >
          <div
            className="w-full max-w-md bg-surface-container-lowest h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
                <div>
                  <h3 className="font-title-lg text-title-lg font-bold text-on-surface">
                    {isEditMode ? 'Edit Resident Profile' : 'Resident Profile'}
                  </h3>
                  <p className="text-xs text-secondary">
                    {isEditMode ? 'Update student information and phone numbers' : 'View profile details & mobile credentials'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditMode ? (
                    <button
                      type="button"
                      onClick={() => setIsEditMode(true)}
                      className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors"
                      title="Edit resident profile"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      <span>Edit</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditMode(false)}
                      className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors"
                      title="View resident profile"
                    >
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                      <span>View</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileDrawerOpen(false);
                      setIsEditMode(false);
                    }}
                    className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>

              {/* Mode 1: Edit Form */}
              {isEditMode ? (
                <form onSubmit={handleSaveStudentEdit} className="space-y-4 pt-1">
                  {/* Readonly ID Banner */}
                  <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
                    <span className="text-xs text-secondary font-medium">Resident ID:</span>
                    <span className="font-code-sm font-bold text-on-surface bg-surface-container px-2 py-0.5 rounded text-xs">
                      {selectedStudent.studentId}
                    </span>
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-sm">person</span>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="e.g. Ananya Sharma"
                        className="w-full pl-9 pr-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* Roll No and Room */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Roll Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editRollNo}
                        onChange={(e) => setEditRollNo(e.target.value)}
                        placeholder="e.g. #10"
                        className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Room Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editRoom}
                        onChange={(e) => setEditRoom(e.target.value)}
                        placeholder="e.g. 101"
                        className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* Assigned Hostel */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Assigned Hostel <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editHostelId}
                      onChange={(e) => setEditHostelId(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {(isAdmin ? hostels : authorizedHostels).map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Student Email */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Student Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-sm">mail</span>
                      <input
                        type="email"
                        required
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="e.g. student@her.com"
                        className="w-full pl-9 pr-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* Student Mobile Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Student Mobile Phone <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-sm">call</span>
                      <input
                        type="tel"
                        required
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="6267549800"
                        className="w-full pl-9 pr-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* Parent / Guardian Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Parent / Guardian Phone
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-sm">family_restroom</span>
                      <input
                        type="tel"
                        value={editGuardianPhone}
                        onChange={(e) => setEditGuardianPhone(e.target.value)}
                        placeholder="6267549800"
                        className="w-full pl-9 pr-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* Account Status */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">Account Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive')}
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="active">Active (Can log in & check in)</option>
                      <option value="inactive">Inactive (Access suspended)</option>
                    </select>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 flex items-center justify-between gap-3 border-t border-outline-variant/20">
                    <button
                      type="button"
                      onClick={() => handleDeleteStudent(selectedStudent)}
                      disabled={isDeletingStudent}
                      className="px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                      title="Delete resident permanently"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      <span>{isDeletingStudent ? 'Deleting...' : 'Delete'}</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditMode(false)}
                        className="px-4 py-2 rounded-xl border border-outline-variant/30 hover:bg-surface-container text-on-surface text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingEdit}
                        className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-on-primary text-xs font-semibold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">save</span>
                        <span>{isSavingEdit ? 'Saving...' : 'Save Changes'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                /* Mode 2: View Profile */
                <>
                  <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary text-on-primary font-bold text-lg flex items-center justify-center">
                      {selectedStudent.avatarInitials}
                    </div>
                    <div>
                      <p className="font-title-md font-bold text-on-surface">{selectedStudent.name}</p>
                      <p className="font-code-sm text-secondary">
                        {selectedStudent.rollNo} · Room {selectedStudent.room}
                      </p>
                      <p className="font-label-xs text-secondary mt-0.5">HER-SPACE Resident</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-container-low/70 space-y-2.5">
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="text-secondary">Student ID:</span>
                      <span className="font-code-sm font-semibold text-on-surface">{selectedStudent.studentId}</span>
                    </div>
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="text-secondary">Hostel:</span>
                      <span className="text-on-surface font-semibold">
                        {hostels.find((h) => h.id === selectedStudent.hostelId)?.name || selectedStudent.hostelId || 'Unassigned'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="text-secondary">Roll Number:</span>
                      <span className="font-mono text-on-surface font-semibold">{selectedStudent.rollNo}</span>
                    </div>
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="text-secondary">Room:</span>
                      <span className="text-on-surface font-semibold">Room {selectedStudent.room}</span>
                    </div>
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="text-secondary">Email:</span>
                      <span className="text-on-surface font-medium">{selectedStudent.email}</span>
                    </div>
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="text-secondary">Student Phone:</span>
                      <span className="text-on-surface font-medium">{selectedStudent.phone}</span>
                    </div>
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="text-secondary">Parent Phone:</span>
                      <span className="text-on-surface font-medium">{selectedStudent.guardianPhone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="text-secondary">Current Status:</span>
                      <span className={`font-semibold ${selectedStudent.status === 'active' ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {selectedStudent.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {/* Prominent Edit Resident Button */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setIsEditMode(true)}
                      className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-label-md font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                      <span>Edit Resident Details</span>
                    </button>
                  </div>

                  {/* Account Setup Link Card */}
                  <div className="p-4 rounded-xl bg-violet-50 border border-violet-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-violet-900 text-xs">Mobile Account Setup Link</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-violet-200 text-violet-800">
                        {selectedStudent.invitationStatus || 'pending'}
                      </span>
                    </div>
                    <p className="text-[11px] text-violet-800">
                      Single-use 48-hour secure onboarding link for mobile phone password setup.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedStudent.setupLink) {
                            navigator.clipboard.writeText(selectedStudent.setupLink);
                            showToast('Copied setup link to clipboard!');
                          } else {
                            handleRegenerateLink(selectedStudent);
                          }
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs cursor-pointer transition-colors"
                      >
                        Copy Link
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRegenerateLink(selectedStudent)}
                        className="px-3 py-1.5 rounded-lg border border-violet-300 hover:bg-violet-100 text-violet-900 font-semibold text-xs cursor-pointer transition-colors"
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>

                  <div className="pt-1 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleStudentStatus(selectedStudent)}
                      className={`w-full py-2.5 rounded-xl font-label-md font-semibold transition-colors cursor-pointer border ${
                        selectedStudent.status === 'active'
                          ? 'border-red-300 text-red-600 hover:bg-red-50'
                          : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {selectedStudent.status === 'active' ? 'Deactivate Student Account' : 'Reactivate Student Account'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteStudent(selectedStudent)}
                      disabled={isDeletingStudent}
                      className="w-full py-2.5 rounded-xl font-label-md font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                      <span>Delete Resident Record</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="pt-6">
              <button
                type="button"
                onClick={() => {
                  setIsProfileDrawerOpen(false);
                  setIsEditMode(false);
                }}
                className="w-full py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Bulk Import Modal */}
      {isCsvModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsCsvModalOpen(false)}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl max-w-lg w-full shadow-2xl p-6 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
              <h3 className="font-title-lg text-title-lg font-bold text-on-surface">Bulk Import Students</h3>
              <button
                type="button"
                onClick={() => setIsCsvModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="font-body-sm text-body-sm text-secondary">
              Upload a CSV file with student names, roll numbers, rooms, emails, and phone numbers.
            </p>

            <button
              type="button"
              onClick={handleDownloadSampleTemplate}
              className="inline-flex items-center gap-1.5 text-primary font-label-sm font-semibold hover:underline cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Download Sample CSV Template</span>
            </button>

            <label className="p-6 rounded-2xl bg-surface-container-low border-2 border-dashed border-outline-variant/50 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary transition-colors">
              <input type="file" accept=".csv" onChange={handleCsvFileUpload} className="hidden" />
              <span className="material-symbols-outlined text-[36px] text-primary mb-2">cloud_upload</span>
              <span className="font-title-sm font-semibold text-on-surface">
                {uploadedFileName || 'Choose a CSV file to upload'}
              </span>
              <span className="font-label-xs text-secondary mt-1">Tap to browse files</span>
            </label>

            {csvValidationResult && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-body-sm font-medium">
                Found {csvValidationResult.importedCount} valid student records ready to import.
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/30">
              <button
                type="button"
                onClick={() => setIsCsvModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-outline-variant/30 hover:bg-surface-container text-on-surface font-label-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkImportConfirm}
                disabled={!csvValidationResult || csvValidationResult.importedCount === 0}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-label-md font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Import Students
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Setup Link Sharing Modal */}
      {setupLinkDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="max-w-md w-full bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">link</span>
                <h3 className="font-title-md font-bold text-on-surface">Resident Setup Link</h3>
              </div>
              <button
                onClick={() => setSetupLinkDialog(null)}
                className="text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="text-xs text-secondary">
              Share this personal setup link with <strong className="text-on-surface">{setupLinkDialog.studentName}</strong>. They will open it on their mobile browser to verify their identity and set their password.
            </p>

            <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-3 text-xs font-mono break-all select-all text-on-surface">
              {setupLinkDialog.setupUrl}
            </div>

            <div className="text-[11px] text-secondary space-y-1">
              <p>• Unpredictable & single-use (expires in 48 hours).</p>
              <p>• Token hash is securely verified on the server.</p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setSetupLinkDialog(null)}
                className="px-4 py-2 rounded-xl border border-outline-variant/30 text-secondary hover:text-on-surface cursor-pointer text-xs font-semibold"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(setupLinkDialog.setupUrl);
                  showToast('Copied setup link to clipboard!');
                }}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs font-semibold cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                <span>Copy Link</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Backward-compatible alias for existing imports
export const Screen6StudentManagement = StudentManagementView;
