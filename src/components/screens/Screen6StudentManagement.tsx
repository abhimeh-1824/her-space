import React, { useState, useEffect } from 'react';
import { AppScreen, Student, CsvImportResult } from '../../types';
import { parseAndValidateStudentCsv } from '../../lib/hostel-service';
import { subscribeToStudents, saveStudentToDb, batchImportStudentsToDb } from '../../lib/db-seed';

interface Screen6StudentManagementProps {
  onNavigate: (screen: AppScreen) => void;
  onLogout: () => void;
}

type RosterState = 'default' | 'add-drawer' | 'csv-modal' | 'profile-drawer' | 'empty' | 'loading';

export const Screen6StudentManagement: React.FC<Screen6StudentManagementProps> = ({
  onNavigate,
  onLogout,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState(true);
  const [rosterState, setRosterState] = useState<RosterState>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBlock, setFilterBlock] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDevice, setFilterDevice] = useState('all');

  // Modals & Drawers
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToStudents((liveStudents) => {
      setStudents(liveStudents);
      setIsLoadingLive(false);
      if (liveStudents.length > 0 && !selectedStudent) {
        setSelectedStudent(liveStudents[0]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Add Student Form State
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentRoll, setNewStudentRoll] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [newStudentRoom, setNewStudentRoom] = useState('b-205');

  // CSV Import State
  const [csvTextInput, setCsvTextInput] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('sunrise_hostel_roster_oct2026.csv');
  const [csvValidationResult, setCsvValidationResult] = useState<CsvImportResult | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

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
      'Aakash Verma,#23CSE012,A-101,aakash.v@campus.edu,+91 98160 11223,1st Sem',
      'Divya Sharma,#22ECE045,B-205,divya.s@campus.edu,+91 98160 22334,3rd Sem',
      'Rohan Sen,#21MEC033,C-302,rohan.s@campus.edu,+91 98160 33445,5th Sem',
    ].join('\r\n');
    downloadCsv('HostelGuard_Student_Import_Template_v2.4.csv', template);
    showToast('Downloaded official student onboarding template.');
  };

  const handleExportRoster = () => {
    const headers = 'Student ID,Name,Roll No,Room,Block,Floor,Email,Phone,Status,Device Status,Attendance Status';
    const rows = students.map((s) =>
      [
        s.studentId,
        `"${s.name}"`,
        `"${s.rollNo}"`,
        s.room,
        `"${s.block}"`,
        s.floor,
        s.email,
        s.phone,
        s.status,
        s.deviceStatus,
        s.attendanceStatus,
      ].join(',')
    );
    const csv = [headers, ...rows].join('\r\n');
    downloadCsv(`HostelGuard_Student_Roster_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    showToast(`Exported ${students.length} resident records to CSV.`);
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || '');
      setCsvTextInput(text);
      const res = parseAndValidateStudentCsv(text, 'HST-SUN-01');
      setCsvValidationResult(res);
      showToast(`Parsed CSV: ${res.importedCount} valid records, ${res.errors.length} issues.`);
    };
    reader.readAsText(file);
  };

  const handleStatePreset = (st: RosterState) => {
    setRosterState(st);
    if (st === 'add-drawer') {
      setIsAddDrawerOpen(true);
      setIsProfileDrawerOpen(false);
      setIsCsvModalOpen(false);
    } else if (st === 'profile-drawer') {
      setSelectedStudent(students[0] || null);
      setIsProfileDrawerOpen(true);
      setIsAddDrawerOpen(false);
      setIsCsvModalOpen(false);
    } else if (st === 'csv-modal') {
      setIsCsvModalOpen(true);
      setIsAddDrawerOpen(false);
      setIsProfileDrawerOpen(false);
    } else {
      setIsAddDrawerOpen(false);
      setIsProfileDrawerOpen(false);
      setIsCsvModalOpen(false);
    }
  };

  const filteredStudents = students.filter((stu) => {
    const matchesSearch =
      stu.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stu.rollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stu.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stu.studentId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesBlock =
      filterBlock === 'all'
        ? true
        : filterBlock === 'block-a'
        ? stu.block === 'Block A'
        : filterBlock === 'block-b'
        ? stu.block === 'Block B'
        : stu.block === 'Block C';

    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'active'
        ? stu.status === 'active'
        : stu.status === 'inactive';

    const matchesDevice =
      filterDevice === 'all'
        ? true
        : filterDevice === 'registered'
        ? stu.deviceStatus === 'registered'
        : filterDevice === 'stale'
        ? stu.deviceStatus === 'stale'
        : stu.deviceStatus === 'pending';

    return matchesSearch && matchesBlock && matchesStatus && matchesDevice;
  });

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName || !newStudentRoll || !newStudentEmail) {
      alert('Please fill out all required fields.');
      return;
    }

    const created: Student = {
      id: `stu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      studentId: `STU-${120 + students.length + 1}`,
      name: newStudentName,
      rollNo: newStudentRoll.startsWith('#') ? newStudentRoll : `#${newStudentRoll}`,
      semester: '1st Sem',
      room: newStudentRoom.toUpperCase(),
      block: newStudentRoom.toUpperCase().startsWith('A') ? 'Block A' : newStudentRoom.toUpperCase().startsWith('B') ? 'Block B' : 'Block C',
      floor: 2,
      email: newStudentEmail,
      phone: newStudentPhone || '+91 98000 00000',
      status: 'active',
      device: 'Pending Binding',
      browser: 'Web Push Unbound',
      deviceStatus: 'pending',
      attendanceStatus: 'Pending',
      lastUpdated: 'Just now',
      guardianPhone: '+91 98000 11111',
      avatarInitials: newStudentName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
    };

    try {
      await saveStudentToDb(created);
      setIsAddDrawerOpen(false);
      setNewStudentName('');
      setNewStudentRoll('');
      setNewStudentEmail('');
      setNewStudentPhone('');
      showToast(`Resident provisioned: ${created.name} (${created.studentId}) saved directly to Firestore.`);
    } catch (err) {
      console.warn('Direct Firestore save note, applying local state:', err);
      setStudents([created, ...students]);
      setIsAddDrawerOpen(false);
      showToast(`Resident provisioned: ${created.name} (${created.studentId})`);
    }
  };

  const handleBulkImportConfirm = async () => {
    if (csvValidationResult && csvValidationResult.importedStudents.length > 0) {
      try {
        await batchImportStudentsToDb(csvValidationResult.importedStudents);
        setIsCsvModalOpen(false);
        showToast(
          `Batch import executed: ${csvValidationResult.importedStudents.length} student records committed to live Firestore.`
        );
      } catch (err) {
        console.warn('Batch import Firestore note, applying local state:', err);
        setStudents((prev) => [...csvValidationResult.importedStudents, ...prev]);
        setIsCsvModalOpen(false);
        showToast(
          `Batch import executed: ${csvValidationResult.importedStudents.length} student records enrolled.`
        );
      }
    } else {
      setIsCsvModalOpen(false);
    }
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen flex">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 flex pointer-events-none">
          <div className="bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium">
            <span className="material-symbols-outlined text-primary-fixed text-lg">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Persistent Left Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-lowest z-40 hidden lg:flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-outline-variant/30">
        <div className="flex flex-col">
          <div className="h-16 px-4 flex items-center gap-2.5 bg-surface-container-lowest border-b border-surface-container">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm">
              <span className="material-symbols-outlined text-[20px]">shield</span>
            </div>
            <div className="flex flex-col">
              <span className="font-title-md text-title-md font-bold tracking-tight text-on-surface leading-tight">
                HostelGuard
              </span>
              <span className="font-code-sm text-code-sm text-on-surface-variant">v2.4 NightAudit</span>
            </div>
          </div>

          <div className="px-4 py-2">
            <div className="bg-surface-container-low rounded-xl p-2.5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                  Tenancy Role
                </span>
                <span className="font-label-xs text-label-xs font-semibold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed">
                  Active
                </span>
              </div>
              <span className="font-title-sm text-title-sm text-on-surface font-bold">Warden Portal</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                North Campus Jurisdiction
              </span>
            </div>
          </div>

          <nav className="flex flex-col gap-1 px-4 mt-2">
            <button
              type="button"
              onClick={() => onNavigate('warden-dashboard')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('attendance-monitoring')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">checklist_rtl</span>
              <span>Attendance Monitoring</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary-container text-on-primary font-semibold text-sm transition-all text-left"
            >
              <span className="material-symbols-outlined text-[20px]">group</span>
              <span>Student Management</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('hostel-settings')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">history_edu</span>
              <span>Reports &amp; History</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('hostel-settings')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">tune</span>
              <span>Hostel Settings</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('terms-privacy')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">policy</span>
              <span>Legal &amp; Privacy</span>
            </button>
          </nav>
        </div>

        <div className="p-4 bg-surface-container-lowest border-t border-surface-container flex flex-col gap-2">
          <div className="p-2 bg-surface-container-low rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs">
                WS
              </div>
              <div className="flex flex-col max-w-[110px]">
                <span className="font-title-sm text-title-sm text-on-surface font-semibold truncate">Warden Sharma</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant truncate">Sunrise Complex</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-error transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-30 px-6 flex items-center justify-between border-b border-surface-container">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">
                Warden Dashboard
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Monitor tonight’s hostel attendance at a glance
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-full">
              <span className="material-symbols-outlined text-primary text-[18px]">schedule</span>
              <span className="font-label-xs text-label-xs font-semibold text-on-surface">
                Roll-Call Active: 10:00 PM – 12:00 AM
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs">
              WS
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="relative pt-20 pb-16 px-4 md:px-8 bg-background flex flex-col gap-6">
          {/* Prototype Scenario Switcher Bar */}
          <div className="w-full bg-surface-container-low/80 backdrop-blur-md rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-xs text-label-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Prototype State Control:
              </span>
              <span className="font-code-sm text-code-sm text-primary font-medium ml-1">
                Screen 6 / Student Roster
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  ['default', 'Default Roster (120)'],
                  ['add-drawer', '+ Add Student Drawer'],
                  ['csv-modal', 'Bulk CSV Import Modal'],
                  ['profile-drawer', 'View Profile (STU-102)'],
                  ['empty', 'Empty Search State'],
                  ['loading', 'Loading Skeleton'],
                ] as [RosterState, string][]
              ).map(([st, label]) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => handleStatePreset(st)}
                  className={`px-3 py-1 rounded-xl font-label-xs text-label-xs transition-all shadow-xs cursor-pointer ${
                    rosterState === st
                      ? 'bg-primary text-on-primary font-semibold'
                      : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Subheader / Management Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-headline-md text-headline-md font-bold tracking-tight text-on-surface">
                  Student Resident Registry
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-label-xs text-label-xs font-semibold">
                  Active Roster
                </span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Configure room occupancies, oversee push-notification devices, and manage student tenancy records.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCsvModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface shadow-xs font-label-md text-label-md transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">upload_file</span>
                <span>Import Students</span>
              </button>
              <button
                type="button"
                onClick={handleExportRoster}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface shadow-xs font-label-md text-label-md transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">file_download</span>
                <span>Export Roster</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-label-md text-label-md transition-all shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span>+ Add Student</span>
              </button>
            </div>
          </div>

          {/* Hostel Tenancy Context Banner */}
          <div className="w-full bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary-container text-on-secondary-fixed flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[26px]">apartment</span>
              </div>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-title-md text-title-md font-bold text-on-surface">Sunrise Boys Hostel</span>
                  <span className="font-code-sm text-code-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-medium">
                    Jurisdiction: #HST-SUN-01
                  </span>
                  <span className="font-code-sm text-code-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-medium">
                    Node: HP-KL-02
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  <span className="font-semibold text-on-surface">Tenancy Rule:</span> Warden clearance restricted to authorized properties. Student cross-hostel transfers require Central Administration approval.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 bg-surface-container-low p-1.5 rounded-xl">
              <div className="px-3 py-1 rounded-xl bg-surface-container-lowest shadow-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                <span className="font-label-xs text-on-surface-variant">Active Accounts:</span>
                <span className="font-title-sm text-title-sm font-bold text-on-surface">116</span>
              </div>
              <div className="px-3 py-1 rounded-xl bg-surface-container-lowest shadow-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-error"></span>
                <span className="font-label-xs text-on-surface-variant">Inactive:</span>
                <span className="font-title-sm text-title-sm font-bold text-on-surface">4</span>
              </div>
              <div className="px-3 py-1 rounded-xl bg-surface-container-lowest shadow-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-secondary"></span>
                <span className="font-label-xs text-on-surface-variant">Available Rooms:</span>
                <span className="font-title-sm text-title-sm font-bold text-on-surface">18</span>
                <span className="font-code-sm text-code-sm text-on-surface-variant ml-0.5">(A:6 · B:8 · C:4)</span>
              </div>
            </div>
          </div>

          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                  Total Students
                </span>
                <div className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">group</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-display-hero text-display-hero font-bold tracking-tight text-on-surface">120</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">/ 130 max</span>
              </div>
              <div className="mt-2 flex items-center justify-between pt-1">
                <div className="w-full bg-surface-container-high rounded-full h-1.5 mr-2 overflow-hidden">
                  <div className="bg-primary h-1.5 rounded-full" style={{ width: '92.3%' }}></div>
                </div>
                <span className="font-code-sm text-code-sm font-semibold text-primary shrink-0">92.3% cap</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                  Active Residents
                </span>
                <div className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-display-hero text-display-hero font-bold tracking-tight text-on-surface">116</span>
                <span className="font-label-sm text-label-sm text-primary font-semibold">Verified</span>
              </div>
              <div className="mt-2 flex items-center justify-between pt-1">
                <span className="font-body-sm text-body-sm text-on-surface-variant">Roll-call enabled</span>
                <span className="font-code-sm text-code-sm font-semibold text-on-surface">96.7% rate</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                  Inactive Accounts
                </span>
                <div className="w-8 h-8 rounded-xl bg-error-container text-on-error-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">person_off</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-display-hero text-display-hero font-bold tracking-tight text-error">4</span>
                <span className="font-label-sm text-label-sm text-error font-medium">Attention</span>
              </div>
              <div className="mt-2 flex items-center justify-between pt-1">
                <span className="font-body-sm text-body-sm text-on-surface-variant">Suspended / Pending</span>
                <span className="font-code-sm text-code-sm font-semibold text-error">3.3% hold</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                  Devices Registered
                </span>
                <div className="w-8 h-8 rounded-xl bg-secondary-container text-on-secondary-fixed flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">phonelink_ring</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-display-hero text-display-hero font-bold tracking-tight text-on-surface">108</span>
                <span className="font-label-sm text-label-sm text-secondary font-medium">/ 120</span>
              </div>
              <div className="mt-2 flex items-center justify-between pt-1">
                <div className="w-full bg-surface-container-high rounded-full h-1.5 mr-2 overflow-hidden">
                  <div className="bg-primary h-1.5 rounded-full" style={{ width: '90%' }}></div>
                </div>
                <span className="font-code-sm text-code-sm font-semibold text-primary shrink-0">90.0% Push</span>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[20px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by student name, roll number, email, or student ID (e.g., STU-102)..."
                  className="w-full pl-10 pr-4 py-2 bg-surface-container-low rounded-xl text-on-surface placeholder:text-on-surface-variant font-body-md text-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterBlock}
                  onChange={(e) => setFilterBlock(e.target.value)}
                  className="bg-surface-container-low text-on-surface font-label-md py-2 px-3 rounded-xl focus:outline-none cursor-pointer"
                >
                  <option value="all">Room Block: All</option>
                  <option value="block-a">Block A</option>
                  <option value="block-b">Block B</option>
                  <option value="block-c">Block C</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-surface-container-low text-on-surface font-label-md py-2 px-3 rounded-xl focus:outline-none cursor-pointer"
                >
                  <option value="all">Status: All</option>
                  <option value="active">Active Residents</option>
                  <option value="inactive">Inactive</option>
                </select>

                <select
                  value={filterDevice}
                  onChange={(e) => setFilterDevice(e.target.value)}
                  className="bg-surface-container-low text-on-surface font-label-md py-2 px-3 rounded-xl focus:outline-none cursor-pointer"
                >
                  <option value="all">Device: All</option>
                  <option value="registered">Push Registered</option>
                  <option value="pending">Not Registered</option>
                  <option value="stale">Token Stale</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterBlock('all');
                    setFilterStatus('all');
                    setFilterDevice('all');
                  }}
                  className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-xl transition-colors cursor-pointer"
                  title="Reset Filters"
                >
                  <span className="material-symbols-outlined text-[20px]">filter_alt_off</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between text-on-surface-variant font-body-sm text-body-sm pt-1 border-t border-surface-container">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary">filter_list</span>
                <span>Showing {filteredStudents.length} active resident samples</span>
              </span>
              <div className="flex items-center gap-3 font-code-sm text-code-sm">
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span> 116 Active
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-error"></span> 4 Inactive
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> 108 FCM Bound
                </span>
              </div>
            </div>
          </div>

          {/* Roster Table */}
          {rosterState === 'loading' ? (
            <div className="p-4 bg-surface-container-lowest rounded-xl flex flex-col gap-3 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-surface-container-low rounded-xl"></div>
              ))}
            </div>
          ) : rosterState === 'empty' || filteredStudents.length === 0 ? (
            <div className="p-12 bg-surface-container-lowest rounded-xl flex flex-col items-center text-center">
              <span className="material-symbols-outlined text-[48px] text-secondary mb-2">person_search</span>
              <h3 className="font-title-md font-bold text-on-surface">No resident students found</h3>
              <p className="font-body-md text-secondary max-w-sm mt-1">
                No records matching your search queries or filter combinations under Sunrise Boys Hostel.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterBlock('all');
                  setFilterStatus('all');
                  setFilterDevice('all');
                  setRosterState('default');
                }}
                className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-xl font-label-md cursor-pointer"
              >
                Clear All Query Filters
              </button>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant font-label-xs text-label-xs uppercase tracking-wider">
                      <th className="py-3 px-4 font-semibold">Student &amp; Identity</th>
                      <th className="py-3 px-4 font-semibold">Student ID</th>
                      <th className="py-3 px-4 font-semibold">Room &amp; Block</th>
                      <th className="py-3 px-4 font-semibold">Contact Info</th>
                      <th className="py-3 px-4 font-semibold">Account Status</th>
                      <th className="py-3 px-4 font-semibold">Device &amp; FCM</th>
                      <th className="py-3 px-4 font-semibold">Attendance Update</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container font-body-sm text-body-sm text-on-surface">
                    {filteredStudents.map((stu) => (
                      <tr key={stu.id} className="hover:bg-surface-container-low/50 transition-colors group">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-sm shrink-0">
                              {stu.avatarInitials}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span
                                onClick={() => {
                                  setSelectedStudent(stu);
                                  setIsProfileDrawerOpen(true);
                                }}
                                className="font-title-sm text-title-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors cursor-pointer"
                              >
                                {stu.name}
                              </span>
                              <span className="font-code-sm text-code-sm text-on-surface-variant">
                                Roll {stu.rollNo} · {stu.semester}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-code-sm text-code-sm font-semibold text-primary">
                          {stu.studentId}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-lg bg-surface-container-high font-semibold text-on-surface text-xs">
                              {stu.room}
                            </span>
                            <span className="text-on-surface-variant font-body-sm">{stu.block}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col text-on-surface-variant font-body-sm">
                            <span className="truncate">{stu.email}</span>
                            <span className="font-code-sm text-code-sm">{stu.phone}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-xs font-semibold ${
                              stu.status === 'active'
                                ? 'bg-secondary-container text-on-secondary-fixed'
                                : 'bg-error-container text-on-error-container'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                stu.status === 'active' ? 'bg-primary' : 'bg-error'
                              }`}
                            ></span>
                            {stu.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`material-symbols-outlined text-[16px] ${
                                stu.deviceStatus === 'registered'
                                  ? 'text-primary'
                                  : stu.deviceStatus === 'stale'
                                  ? 'text-error'
                                  : 'text-on-surface-variant'
                              }`}
                            >
                              {stu.deviceStatus === 'registered'
                                ? 'phonelink_setup'
                                : stu.deviceStatus === 'stale'
                                ? 'mobile_off'
                                : 'phonelink_erase'}
                            </span>
                            <div className="flex flex-col">
                              <span className="font-label-sm text-on-surface font-medium">{stu.device}</span>
                              <span
                                className={`font-code-sm text-code-sm ${
                                  stu.deviceStatus === 'stale' ? 'text-error' : 'text-on-surface-variant'
                                }`}
                              >
                                {stu.browser}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-label-xs font-semibold text-primary">
                              {stu.attendanceTime ? `Today, ${stu.attendanceTime}` : 'Today, 10:15 PM'}
                            </span>
                            <span className="font-code-sm text-code-sm text-on-surface-variant">
                              {stu.attendanceStatus === 'IN'
                                ? 'IN · Geofence Verified'
                                : stu.attendanceStatus === 'OUT'
                                ? 'OUT · Academic Permit'
                                : stu.attendanceStatus === 'Late'
                                ? 'Curfew Ext: Approved'
                                : stu.attendanceStatus === 'Exception'
                                ? 'Suspension Logged'
                                : 'Pending Verification'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudent(stu);
                                setIsProfileDrawerOpen(true);
                              }}
                              className="p-1.5 rounded-xl hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                              title="View Full Resident Record"
                            >
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => showToast(`Options menu for ${stu.name}`)}
                              className="p-1.5 rounded-xl hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">more_vert</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table pagination */}
              <div className="p-4 border-t border-surface-container flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="font-body-sm text-on-surface-variant">
                  Showing 1–{filteredStudents.length} of 120 students · Page 1 of 12
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled
                    className="px-3 py-1.5 rounded-xl bg-surface-container-lowest text-on-surface-variant opacity-40 cursor-not-allowed font-label-sm flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                    <span>Previous</span>
                  </button>
                  <button className="w-8 h-8 rounded-xl bg-primary text-on-primary font-label-sm font-bold shadow-xs">
                    1
                  </button>
                  <button className="w-8 h-8 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-sm shadow-xs">
                    2
                  </button>
                  <button className="w-8 h-8 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-sm shadow-xs">
                    3
                  </button>
                  <span className="px-1 text-on-surface-variant">...</span>
                  <button className="w-8 h-8 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-sm shadow-xs">
                    12
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-sm flex items-center gap-1 cursor-pointer"
                  >
                    <span>Next</span>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tenancy Compliance Isolation Protocol Footer */}
          <div className="w-full bg-surface-container-low rounded-xl p-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-primary text-[22px] shrink-0 mt-0.5">verified_user</span>
            <div className="flex flex-col gap-0.5">
              <span className="font-title-sm text-title-sm font-bold text-on-surface">
                HostelGuard Tenancy Compliance Isolation Protocol
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Resident records, biometric verification logs, and device push tokens are scoped specifically to{' '}
                <strong className="text-on-surface">Sunrise Boys Hostel (Tenancy Node HP-KL-02)</strong>. Direct student records mutation or hostel reassignment triggers cryptographic audit events logged to Central Administration. Wardens are not permitted to inspect unassigned hostels.
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* Slide-over Drawer: Add Student Form */}
      {isAddDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex justify-end"
          onClick={() => setIsAddDrawerOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface-container-lowest h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 bg-surface-container-low flex items-center justify-between border-b border-surface-container">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">person_add</span>
                </div>
                <div>
                  <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Add New Resident</h2>
                  <span className="font-body-sm text-on-surface-variant">Sunrise Boys Hostel (#HST-SUN-01)</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDrawerOpen(false)}
                className="w-8 h-8 rounded-xl hover:bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-6 flex-1 flex flex-col gap-4 overflow-y-auto">
              <div className="flex flex-col gap-1">
                <label className="font-label-sm font-semibold text-on-surface">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Navdeep Singh"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="px-3 py-2 bg-surface-container-low rounded-xl text-on-surface font-body-md focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm font-semibold text-on-surface">Student ID *</label>
                  <input
                    type="text"
                    readOnly
                    value={`STU-${120 + students.length + 1}`}
                    className="px-3 py-2 bg-surface-container-high/60 rounded-xl font-code-sm text-primary font-bold focus:outline-none cursor-not-allowed"
                  />
                  <span className="font-code-sm text-xs text-on-surface-variant">Auto-generated</span>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm font-semibold text-on-surface">College Roll No. *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 23CSE011"
                    value={newStudentRoll}
                    onChange={(e) => setNewStudentRoll(e.target.value)}
                    className="px-3 py-2 bg-surface-container-low rounded-xl text-on-surface font-code-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm font-semibold text-on-surface">Institutional Email *</label>
                <input
                  type="email"
                  required
                  placeholder="name@campus.edu"
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  className="px-3 py-2 bg-surface-container-low rounded-xl text-on-surface font-body-md focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
                <span className="font-body-sm text-xs text-on-surface-variant">Must end with authorized @campus.edu domain</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm font-semibold text-on-surface">Mobile Contact *</label>
                <input
                  type="tel"
                  placeholder="+91 98000 00000"
                  value={newStudentPhone}
                  onChange={(e) => setNewStudentPhone(e.target.value)}
                  className="px-3 py-2 bg-surface-container-low rounded-xl text-on-surface font-body-md focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm font-semibold text-on-surface">Assigned Hostel</label>
                <div className="px-3 py-2 bg-surface-container-high/60 rounded-xl flex items-center justify-between text-on-surface-variant">
                  <span className="font-body-md font-medium text-on-surface">Sunrise Boys Hostel</span>
                  <span className="font-code-sm text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                    Tenancy Locked
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm font-semibold text-on-surface">Room Assignment *</label>
                <select
                  value={newStudentRoom}
                  onChange={(e) => setNewStudentRoom(e.target.value)}
                  className="px-3 py-2 bg-surface-container-low rounded-xl text-on-surface font-body-md focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:outline-none cursor-pointer"
                >
                  <option value="b-205">Room B-205 (Block B · Floor 2 · 1 Bed Open)</option>
                  <option value="a-104">Room A-104 (Block A · Floor 1 · 2 Beds Open)</option>
                  <option value="a-212">Room A-212 (Block A · Floor 2 · 1 Bed Open)</option>
                  <option value="c-303">Room C-303 (Block C · Floor 3 · 2 Beds Open)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">lock</span>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  Wardens cannot set or view student credentials. An automated activation invitation via Firebase Auth will be dispatched to the resident's institutional email address.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setIsAddDrawerOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-label-md shadow-sm transition-all cursor-pointer font-semibold"
                >
                  Provision &amp; Save Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-over Drawer: Student Profile (STU-102 Rahul Sharma) */}
      {isProfileDrawerOpen && selectedStudent && (
        <div
          className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex justify-end"
          onClick={() => setIsProfileDrawerOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-surface-container-lowest h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative bg-surface-container-low p-6 pb-8">
              <button
                type="button"
                onClick={() => setIsProfileDrawerOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-surface-container-lowest/80 hover:bg-surface-container-lowest flex items-center justify-center text-on-surface shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-bold text-headline-sm shadow-md">
                  {selectedStudent.avatarInitials}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      {selectedStudent.name}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-label-xs font-semibold">
                      {selectedStudent.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    Roll {selectedStudent.rollNo} · B.Tech Comp Sci (Yr 3)
                  </span>
                  <span className="font-label-xs text-primary font-semibold mt-0.5">
                    {selectedStudent.studentId} · Sunrise Boys Hostel
                  </span>
                </div>
              </div>
            </div>

            {/* Content Details */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5 -mt-4 bg-surface-container-lowest rounded-t-2xl">
              <div className="bg-surface-container-low p-4 rounded-xl shadow-xs flex flex-col gap-1">
                <span className="font-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                  Allocated Quarters
                </span>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-headline-sm font-bold text-on-surface">Room {selectedStudent.room}</span>
                    <span className="font-body-sm text-on-surface-variant block">
                      {selectedStudent.block} · Second Floor · Bed 01
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast('Initiated room transfer approval flow.')}
                    className="px-3 py-1 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-primary font-label-xs font-semibold shadow-xs cursor-pointer"
                  >
                    Change Room
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                  Verified Contact Details
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-surface-container-low flex flex-col">
                    <span className="font-label-xs text-on-surface-variant">Email Address</span>
                    <span className="font-body-sm text-on-surface font-medium truncate">{selectedStudent.email}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container-low flex flex-col">
                    <span className="font-label-xs text-on-surface-variant">Emergency Mobile</span>
                    <span className="font-code-sm text-on-surface font-medium">{selectedStudent.phone}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                    Push Hardware &amp; Security Token
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-code-sm text-xs font-semibold">
                    FCM v1 Verified
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-surface-container-low flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-[28px]">phone_android</span>
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-title-sm font-bold text-on-surface">{selectedStudent.device}</span>
                      <span className="font-code-sm text-xs text-primary font-semibold">Hardware Key Active</span>
                    </div>
                    <span className="font-body-sm text-on-surface-variant">{selectedStudent.browser}</span>
                    <span className="font-code-sm text-xs text-on-surface-variant mt-1 truncate">
                      Token: {selectedStudent.fcmToken || 'fcm_live_79ad88f192b001a...'}
                    </span>
                    <span className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                      Last Token Ping: Today at 22:01 IST
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                  Tonight's Roll-Call Status
                </span>
                <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping"></span>
                      <span className="font-title-sm font-bold text-on-surface">Marked IN (Confirmed)</span>
                    </div>
                    <span className="font-code-sm text-xs text-on-surface-variant">10:05 PM IST</span>
                  </div>
                  <div className="p-2 rounded-xl bg-surface-container-lowest flex items-center justify-between shadow-inner">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">near_me</span>
                      <div className="flex flex-col">
                        <span className="font-label-sm text-on-surface font-semibold">
                          Sunrise Hostel Complex Geofence
                        </span>
                        <span className="font-code-sm text-xs text-on-surface-variant">
                          Kullu Campus, HP (±20m precision)
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-code-sm text-xs font-bold">
                      In-Radius
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-surface-container-low flex items-center justify-between gap-3 border-t border-surface-container">
              <button
                type="button"
                onClick={() => {
                  setIsProfileDrawerOpen(false);
                  onNavigate('attendance-history');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-md transition-colors shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">history</span>
                <span>Attendance History</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsProfileDrawerOpen(false)}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-md shadow-xs cursor-pointer font-semibold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bulk CSV Import */}
      {isCsvModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsCsvModalOpen(false)}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 bg-surface-container-low flex items-center justify-between border-b border-surface-container">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-fixed flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">upload_file</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Import Students via CSV
                  </h3>
                  <span className="font-body-sm text-on-surface-variant">
                    Batch resident enrollment for Sunrise Boys Hostel
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCsvModalOpen(false)}
                className="w-8 h-8 rounded-xl hover:bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">table_view</span>
                  <span className="font-body-sm text-on-surface">Ensure your roster adheres to institutional schema.</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleTemplate}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-surface-container-lowest hover:bg-surface-container-high rounded-lg text-primary font-label-xs font-semibold shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">file_download</span>
                  <span>Download Schema (.CSV)</span>
                </button>
              </div>

              {/* Upload Drop Zone Preview & Real File Picker */}
              <label className="p-6 rounded-xl bg-surface-container-low/70 border border-dashed border-primary/40 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-container transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileUpload}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center mb-2 shadow-xs">
                  <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
                </div>
                <span className="font-title-sm font-bold text-on-surface">{uploadedFileName}</span>
                <span className="font-code-sm text-xs text-on-surface-variant mt-0.5">
                  Click or drag file to parse &amp; validate CSV roster
                </span>
                <span className="font-label-xs text-primary font-semibold mt-2">
                  {csvValidationResult ? 'Schema Validated · Ready to Import' : 'Ready for Schema Validation'}
                </span>
              </label>

              {/* Column Mapping Grid */}
              <div className="flex flex-col gap-1.5">
                <span className="font-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                  Column Field Mapping
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-code-sm text-xs">
                  <div className="p-2 rounded-lg bg-surface-container-low flex flex-col">
                    <span className="text-on-surface-variant">Full Name</span>
                    <span className="text-on-surface font-semibold mt-0.5">→ name</span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-container-low flex flex-col">
                    <span className="text-on-surface-variant">Roll/ID</span>
                    <span className="text-on-surface font-semibold mt-0.5">→ rollNo</span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-container-low flex flex-col">
                    <span className="text-on-surface-variant">Room</span>
                    <span className="text-on-surface font-semibold mt-0.5">→ room</span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-container-low flex flex-col">
                    <span className="text-on-surface-variant">Email</span>
                    <span className="text-on-surface font-semibold mt-0.5">→ email</span>
                  </div>
                </div>
              </div>

              {/* Validation Feedback */}
              <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                    Validation Pre-flight Check
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-code-sm text-xs font-bold">
                    {csvValidationResult
                      ? `${csvValidationResult.importedCount} of ${csvValidationResult.totalRows} Valid`
                      : '118 of 120 Valid'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 font-body-sm text-primary">
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    <span>
                      {csvValidationResult
                        ? `${csvValidationResult.importedCount} records validated and ready for allocation.`
                        : '118 records ready for immediate allocation under Sunrise Complex.'}
                    </span>
                  </div>
                  {csvValidationResult && csvValidationResult.errors.length > 0 ? (
                    <div className="flex flex-col gap-0.5 text-xs text-error mt-1 max-h-24 overflow-y-auto">
                      {csvValidationResult.errors.slice(0, 3).map((err, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px]">error</span>
                          <span>
                            Row {err.row} ({err.field}): {err.message}
                          </span>
                        </div>
                      ))}
                      {csvValidationResult.errors.length > 3 && (
                        <span className="text-secondary italic">
                          +{csvValidationResult.errors.length - 3} additional validation warnings
                        </span>
                      )}
                    </div>
                  ) : !csvValidationResult ? (
                    <div className="flex items-center gap-2 font-body-sm text-error">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      <span>
                        2 records skipped: <code className="bg-error-container/40 px-1 rounded">STU-088</code> and{' '}
                        <code className="bg-error-container/40 px-1 rounded">STU-091</code> already assigned.
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="p-6 bg-surface-container-low flex items-center justify-between border-t border-surface-container">
              <button
                type="button"
                onClick={() => setIsCsvModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkImportConfirm}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-label-md shadow-sm transition-all flex items-center gap-2 cursor-pointer font-semibold"
              >
                <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                <span>
                  Import {csvValidationResult ? csvValidationResult.importedCount : 118} Valid Students
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
