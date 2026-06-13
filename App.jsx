import React, { useState, useEffect } from 'react';
import { Users, UserCheck, BarChart3, Download, Plus, Trash2, Save, CheckCircle, XCircle, Clock } from 'lucide-react';

// ใส่ URL ที่ได้จาก Google Apps Script ที่นี่ (ถ้าปล่อยว่างไว้ ระบบจะใช้ Local Storage แทนเพื่อทดสอบ)
const GOOGLE_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwrAfBiXXhpLX52fL6EOyDvtii4VKNV2KW4Dmeh97vrlf871Dvk6di93tDKaa_B8UmK/exec"; 

export default function App() {
  const [activeTab, setActiveTab] = useState('attendance');
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [newStudentName, setNewStudentName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // -----------------------------------------------------
  // 1. โหลดข้อมูลเมื่อเปิดแอป
  // -----------------------------------------------------
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (GOOGLE_WEB_APP_URL) {
        const res = await fetch(`${GOOGLE_WEB_APP_URL}?action=getData`);
        const data = await res.json();
        setStudents(data.students || []);
        setAttendanceRecords(data.attendance || []);
      } else {
        // ใช้ Local Storage ถ้ายังไม่ได้ต่อ Google Sheet
        const localStudents = JSON.parse(localStorage.getItem('students')) || [];
        const localAttendance = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
        setStudents(localStudents);
        setAttendanceRecords(localAttendance);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      showMessage("เกิดข้อผิดพลาดในการดึงข้อมูล");
    }
    setIsLoading(false);
  };

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  // -----------------------------------------------------
  // 2. จัดการรายชื่อนักเรียน (Add / Delete)
  // -----------------------------------------------------
  const addStudent = async () => {
    if (!newStudentName.trim()) return;
    const newStudent = { id: Date.now().toString(), name: newStudentName.trim() };
    const updatedStudents = [...students, newStudent];
    setStudents(updatedStudents);
    setNewStudentName('');

    if (GOOGLE_WEB_APP_URL) {
      await fetch(GOOGLE_WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'addStudent', student: newStudent })
      });
    } else {
      localStorage.setItem('students', JSON.stringify(updatedStudents));
    }
    showMessage("เพิ่มนักเรียนสำเร็จ!");
  };

  const deleteStudent = async (id) => {
    if (!confirm('ยืนยันการลบนักเรียนรายนี้?')) return;
    const updatedStudents = students.filter(s => s.id !== id);
    setStudents(updatedStudents);

    if (GOOGLE_WEB_APP_URL) {
      await fetch(GOOGLE_WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteStudent', id: id })
      });
    } else {
      localStorage.setItem('students', JSON.stringify(updatedStudents));
    }
  };

  // -----------------------------------------------------
  // 3. จัดการการเช็กชื่อ (Attendance)
  // -----------------------------------------------------
  const getTodayStatus = (studentId) => {
    const record = attendanceRecords.find(r => r.date === currentDate && r.studentId === studentId);
    return record ? record.status : 'none'; // 'present', 'absent', 'late', 'none'
  };

  const markAttendance = (student, status) => {
    let updatedRecords = [...attendanceRecords];
    const existingIndex = updatedRecords.findIndex(r => r.date === currentDate && r.studentId === student.id);
    
    if (existingIndex >= 0) {
      updatedRecords[existingIndex].status = status;
    } else {
      updatedRecords.push({ date: currentDate, studentId: student.id, studentName: student.name, status });
    }
    setAttendanceRecords(updatedRecords);
  };

  const saveAttendance = async () => {
    setIsLoading(true);
    const todayRecords = attendanceRecords.filter(r => r.date === currentDate);
    
    if (GOOGLE_WEB_APP_URL) {
      try {
        await fetch(GOOGLE_WEB_APP_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'saveAttendance', date: currentDate, records: todayRecords })
        });
        showMessage("บันทึกข้อมูลลง Google Sheet สำเร็จ!");
      } catch (e) {
        showMessage("บันทึกไม่สำเร็จ");
      }
    } else {
      localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
      showMessage("บันทึกข้อมูลลงในเครื่องสำเร็จ!");
    }
    setIsLoading(false);
  };

  // -----------------------------------------------------
  // 4. สถิติและ Export เป็น Excel (CSV)
  // -----------------------------------------------------
  const exportToExcel = () => {
    // ใช้ BOM เพื่อให้ Excel อ่านภาษาไทยได้ถูกต้อง
    const bom = '\uFEFF';
    let csvContent = "วันที่,รหัสนักเรียน,ชื่อ-สกุล,สถานะ\n";
    
    attendanceRecords.forEach(record => {
      let statusThai = record.status === 'present' ? 'มาเรียน' : record.status === 'absent' ? 'ขาดเรียน' : 'สาย/ลา';
      csvContent += `${record.date},${record.studentId},${record.studentName},${statusThai}\n`;
    });

    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `สถิติการเข้าเรียน_${currentDate}.csv`;
    link.click();
  };

  const calculateStats = () => {
    const stats = { present: 0, absent: 0, late: 0, total: students.length };
    students.forEach(student => {
      const status = getTodayStatus(student.id);
      if (status === 'present') stats.present++;
      else if (status === 'absent') stats.absent++;
      else if (status === 'late') stats.late++;
    });
    return stats;
  };

  const stats = calculateStats();

  // -----------------------------------------------------
  // UI Components
  // -----------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20">
      {/* Header */}
      <header className="bg-blue-600 text-white p-5 rounded-b-3xl shadow-md sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-center">🏫 เช็กชื่อเข้าเรียน</h1>
        {message && (
          <div className="mt-3 text-center bg-white/20 p-2 rounded-xl text-sm font-medium animate-pulse">
            {message}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="p-4 max-w-lg mx-auto">
        
        {/* Tab 1: เช็กชื่อ */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
              <span className="font-bold text-lg">📅 วันที่:</span>
              <input 
                type="date" 
                value={currentDate} 
                onChange={(e) => setCurrentDate(e.target.value)}
                className="bg-slate-100 border-none rounded-xl p-2 font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {students.length === 0 ? (
              <div className="text-center p-10 text-slate-400">
                <Users size={48} className="mx-auto mb-3 opacity-50" />
                <p>ยังไม่มีรายชื่อนักเรียน<br/>กรุณาเพิ่มนักเรียนในเมนู "นักเรียน"</p>
              </div>
            ) : (
              <div className="space-y-3">
                {students.map(student => {
                  const status = getTodayStatus(student.id);
                  return (
                    <div key={student.id} className="bg-white p-4 rounded-2xl shadow-sm">
                      <h3 className="font-semibold text-lg mb-3">{student.name}</h3>
                      <div className="grid grid-cols-3 gap-2">
                        <button 
                          onClick={() => markAttendance(student, 'present')}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${status === 'present' ? 'bg-green-500 text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-500 hover:bg-green-100'}`}
                        >
                          <CheckCircle size={24} className="mb-1" />
                          <span className="text-sm font-medium">มา</span>
                        </button>
                        <button 
                          onClick={() => markAttendance(student, 'absent')}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${status === 'absent' ? 'bg-red-500 text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-500 hover:bg-red-100'}`}
                        >
                          <XCircle size={24} className="mb-1" />
                          <span className="text-sm font-medium">ขาด</span>
                        </button>
                        <button 
                          onClick={() => markAttendance(student, 'late')}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${status === 'late' ? 'bg-orange-500 text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-500 hover:bg-orange-100'}`}
                        >
                          <Clock size={24} className="mb-1" />
                          <span className="text-sm font-medium">ลา/สาย</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {students.length > 0 && (
              <button 
                onClick={saveAttendance}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg mt-6 flex items-center justify-center gap-2 transition-transform active:scale-95"
              >
                <Save size={24} />
                {isLoading ? 'กำลังบันทึก...' : 'บันทึกการเช็กชื่อ'}
              </button>
            )}
          </div>
        )}

        {/* Tab 2: จัดการนักเรียน */}
        {activeTab === 'students' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm">
              <h2 className="font-bold text-lg mb-3">เพิ่มรายชื่อนักเรียน</h2>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="ชื่อ-นามสกุล..." 
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addStudent()}
                  className="flex-1 bg-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  onClick={addStudent}
                  className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 active:scale-95"
                >
                  <Plus size={24} />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b font-bold text-slate-600">
                รายชื่อทั้งหมด ({students.length} คน)
              </div>
              <ul className="divide-y divide-slate-100">
                {students.map(student => (
                  <li key={student.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <span className="font-medium">{student.name}</span>
                    <button 
                      onClick={() => deleteStudent(student.id)}
                      className="text-red-400 hover:text-red-600 p-2"
                    >
                      <Trash2 size={20} />
                    </button>
                  </li>
                ))}
                {students.length === 0 && (
                  <li className="p-8 text-center text-slate-400">ยังไม่มีรายชื่อนักเรียน</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Tab 3: สถิติ */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm">
              <h2 className="font-bold text-xl mb-4 text-center">ภาพรวมวันนี้ ({currentDate})</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-2xl text-center">
                  <div className="text-blue-600 font-bold text-3xl mb-1">{stats.total}</div>
                  <div className="text-sm text-slate-600">นักเรียนทั้งหมด</div>
                </div>
                <div className="bg-green-50 p-4 rounded-2xl text-center">
                  <div className="text-green-600 font-bold text-3xl mb-1">{stats.present}</div>
                  <div className="text-sm text-slate-600">มาเรียน</div>
                </div>
                <div className="bg-red-50 p-4 rounded-2xl text-center">
                  <div className="text-red-600 font-bold text-3xl mb-1">{stats.absent}</div>
                  <div className="text-sm text-slate-600">ขาดเรียน</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-2xl text-center">
                  <div className="text-orange-600 font-bold text-3xl mb-1">{stats.late}</div>
                  <div className="text-sm text-slate-600">สาย/ลา</div>
                </div>
              </div>

              <button 
                onClick={exportToExcel}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md"
              >
                <Download size={24} />
                Export เป็น Excel (CSV)
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 flex justify-around p-3 pb-safe z-50">
        <button 
          onClick={() => setActiveTab('attendance')} 
          className={`flex flex-col items-center flex-1 py-2 rounded-xl ${activeTab === 'attendance' ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <UserCheck size={24} className="mb-1" />
          <span className="text-xs font-bold">เช็กชื่อ</span>
        </button>
        <button 
          onClick={() => setActiveTab('students')} 
          className={`flex flex-col items-center flex-1 py-2 rounded-xl ${activeTab === 'students' ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Users size={24} className="mb-1" />
          <span className="text-xs font-bold">นักเรียน</span>
        </button>
        <button 
          onClick={() => setActiveTab('stats')} 
          className={`flex flex-col items-center flex-1 py-2 rounded-xl ${activeTab === 'stats' ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <BarChart3 size={24} className="mb-1" />
          <span className="text-xs font-bold">สถิติ</span>
        </button>
      </nav>
    </div>
  );
}
