import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import addIcon from "./assets/add.png";
import archiveIcon from "./assets/archive.png";
import assignIcon from "./assets/assign.png";
import clearIcon from "./assets/clear.png";
import deleteIcon from "./assets/delete.png";
import doneIcon from "./assets/done.png";
import editIcon from "./assets/edit.png";
import exportIcon from "./assets/export.png";
import importIcon from "./assets/import.png";
import logoVd from "./assets/logo_vd.svg";
import restoreIcon from "./assets/restore.png";
import searchIcon from "./assets/search.png";
import sidebarIcon from "./assets/sidebar.png";

function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function formatCurrency(value) {
  return `€${Number(value || 0).toFixed(2)}`;
}

function formatExportCurrency(value) {
  const amount = Number(value || 0);
  return `${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)}\u20ac`;
}

function parseMoney(value) {
  return Number(String(value || "").replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function monthFromDate(date) {
  if (!date) return "";
  return String(date).slice(0, 7);
}

function currentDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthInput() {
  return monthFromDate(new Date().toISOString());
}

function formatMonthYear(value) {
  if (!value) return "-";
  const [year, month] = String(value).split("-");
  const monthNames = [
    "Janar",
    "Shkurt",
    "Mars",
    "Prill",
    "Maj",
    "Qershor",
    "Korrik",
    "Gusht",
    "Shtator",
    "Tetor",
    "Nentor",
    "Dhjetor",
  ];
  return monthNames[Number(month) - 1] && year ? `${monthNames[Number(month) - 1]} ${year}` : value;
}

function formatDateDisplay(date) {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

function BrandMark() {
  return (
    <img
      src={logoVd}
      alt="Vatra e Dituris&euml;"
      className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg shadow-sm shrink-0 object-contain bg-white"
    />
  );
}

const emptyStudentForm = {
  firstName: "",
  lastName: "",
  age: "",
  city: "",
  phone: "",
  email: "",
  course: "",
  group: "",
  teacherId: "",
};

const emptyTeacherForm = {
  firstName: "",
  lastName: "",
  percent: 80,
};

const emptyCourseForm = {
  name: "",
  price: "",
};

function normalizeExcelKey(key) {
  return String(key || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getExcelValue(row, keys) {
  const normalizedKeys = keys.map(normalizeExcelKey);
  const match = Object.entries(row).find(([key]) => normalizedKeys.includes(normalizeExcelKey(key)));
  return match ? String(match[1] || "").trim() : "";
}

export default function App() {
  const PRIMARY = "#2e2c80";
  const SECONDARY = "#54807f";
  const HIGHLIGHT = "#80a68a";
  const WARNING = "#d4a017";
  const DANGER = "#c0392b";

  const [students, setStudents] = useLocalStorage("students", []);
  const [teachers, setTeachers] = useLocalStorage("teachers", []);
  const [payments, setPayments] = useLocalStorage("payments", []);
  const [courses, setCourses] = useLocalStorage("courses", []);
  const [archive, setArchive] = useLocalStorage("archive", {
    students: [],
    teachers: [],
    payments: [],
    courses: [],
  });
  const [expenses, setExpenses] = useLocalStorage("expenses", []);

  const [activeView, setActiveView] = useState("students");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedTeacherView, setSelectedTeacherView] = useState(null);
  const [selectedStudentView, setSelectedStudentView] = useState(null);
  const studentImportRef = useRef(null);

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [studentForm, setStudentForm] = useState(emptyStudentForm);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [teacherForm, setTeacherForm] = useState(emptyTeacherForm);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [courseForm, setCourseForm] = useState(emptyCourseForm);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editingCourseName, setEditingCourseName] = useState("");
  const [editingCoursePrice, setEditingCoursePrice] = useState("");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentDate, setPaymentDate] = useState(currentDateInput());
  const [paymentTeacherPercent, setPaymentTeacherPercent] = useState(80);
  const [paymentAdminPercent, setPaymentAdminPercent] = useState(15);
  const [paymentSchoolPercent, setPaymentSchoolPercent] = useState(5);

  const [studentSearch, setStudentSearch] = useState("");
  const [studentGroupFilter, setStudentGroupFilter] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentTeacherFilter, setPaymentTeacherFilter] = useState("");
  const [financeMonth, setFinanceMonth] = useState(currentMonthInput());
  const [financeOverviewMonth, setFinanceOverviewMonth] = useState(currentMonthInput());
  const [financeTeacherFilter, setFinanceTeacherFilter] = useState("");
  const [archiveSearch, setArchiveSearch] = useState("");

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseName, setExpenseName] = useState("");
  const [expenseDate, setExpenseDate] = useState(currentDateInput());
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseMonthFilter, setExpenseMonthFilter] = useState(currentMonthInput());
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editingExpenseName, setEditingExpenseName] = useState("");
  const [editingExpenseDate, setEditingExpenseDate] = useState("");
  const [editingExpenseAmount, setEditingExpenseAmount] = useState("");

  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editingStudentFirstName, setEditingStudentFirstName] = useState("");
  const [editingStudentLastName, setEditingStudentLastName] = useState("");
  const [editingStudentAge, setEditingStudentAge] = useState("");
  const [editingStudentCity, setEditingStudentCity] = useState("");
  const [editingStudentPhone, setEditingStudentPhone] = useState("");
  const [editingStudentEmail, setEditingStudentEmail] = useState("");
  const [editingStudentCourse, setEditingStudentCourse] = useState("");
  const [editingStudentGroup, setEditingStudentGroup] = useState("");
  const [editingStudentTeacherId, setEditingStudentTeacherId] = useState("");

  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editingTeacherFirstName, setEditingTeacherFirstName] = useState("");
  const [editingTeacherLastName, setEditingTeacherLastName] = useState("");
  const [editingTeacherPercent, setEditingTeacherPercent] = useState(80);
  const [isAssignStudentsModalOpen, setIsAssignStudentsModalOpen] = useState(false);
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [assignStudentIds, setAssignStudentIds] = useState([]);

  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [editingPaymentAmount, setEditingPaymentAmount] = useState("");
  const [editingPaymentStudentId, setEditingPaymentStudentId] = useState("");
  const [editingPaymentDate, setEditingPaymentDate] = useState("");
  const [editingPaymentNote, setEditingPaymentNote] = useState("");
  const [isFinanceExportNoteModalOpen, setIsFinanceExportNoteModalOpen] = useState(false);
  const [pendingFinanceExportType, setPendingFinanceExportType] = useState("");
  const [financeExportNote, setFinanceExportNote] = useState("");

  const [archiveSelection, setArchiveSelection] = useState({
    students: [],
    teachers: [],
    payments: [],
    courses: [],
  });
  const [sortConfig, setSortConfig] = useState({
    students: { key: "firstName", direction: "asc" },
    teachers: { key: "name", direction: "asc" },
    payments: { key: "date", direction: "desc" },
    paga: { key: "name", direction: "asc" },
    finance: { key: "date", direction: "desc" },
    courses: { key: "name", direction: "asc" },
    selectedTeacherStudents: { key: "nr", direction: "asc" },
    archive: { key: "name", direction: "asc" },
  });

  const percentOptions = [60, 65, 70, 75, 80];

  const shell = "text-gray-900";
  const sidebar = "border-gray-200";
  const card = "bg-white border-gray-200";
  const input =
    "w-full min-w-0 max-w-full rounded-lg border bg-white border-gray-300 text-gray-900 px-3 py-2 text-sm sm:text-base outline-none focus:ring-2 focus:border-transparent";
  const dateInput = `${input} h-11 appearance-none leading-normal`;
  const smallBtn = "inline-flex items-center justify-center gap-2 px-3 py-2 sm:py-1.5 rounded-lg text-sm font-medium transition text-white";
  const mainBtn = "inline-flex items-center justify-center gap-2 w-full sm:w-auto rounded-lg text-white font-medium px-4 py-2";
  const thClass = "px-3 sm:px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap";
  const tdClass = "px-3 sm:px-4 py-4 align-middle whitespace-nowrap";
  const tableWrap = "overflow-x-auto rounded-lg py-2";
  const roundCheckbox = "h-4 w-4 appearance-none rounded-full border border-gray-300 bg-white checked:border-[#54807f] checked:bg-[#54807f] focus:outline-none focus:ring-2 focus:ring-[#80a68a]";
  const rowHover = "hover:bg-gray-50";
  const selectedRow = "[&>td]:bg-[#80a68a] [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg";
  const sortBtnClass = "flex items-center gap-1 uppercase tracking-wide";

  const primaryBtnStyle = { background: SECONDARY };
  const secondaryBtnStyle = { background: SECONDARY };
  const warningBtnStyle = { background: WARNING };
  const dangerBtnStyle = { background: DANGER };
  const activeNavStyle = { background: HIGHLIGHT, color: "white" };
  const inactiveNavStyle = { color: "white" };
  const disabledPrimaryBtnStyle = { background: SECONDARY, color: "white", cursor: "not-allowed", opacity: 0.55 };
  const icons = {
    search: searchIcon,
    clear: clearIcon,
    restore: restoreIcon,
    delete: deleteIcon,
    export: exportIcon,
    import: importIcon,
    assign: assignIcon,
    add: addIcon,
    archive: archiveIcon,
    edit: editIcon,
  };

  const actionIcon = (type) => (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white">
      <img src={icons[type]} alt="" className="h-4 w-4 object-contain" />
    </span>
  );

  const actionLabel = (type, label) => (
    <>
      {actionIcon(type)}
      <span>{label}</span>
    </>
  );

  const searchField = ({ value, onChange, placeholder }) => (
    <div className="relative w-full">
      <img
        src={icons.search}
        alt=""
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 object-contain opacity-70"
      />
      <input
        className={`${input} pl-9`}
        style={{ boxShadow: "none" }}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );

  const sortRows = (rows, table, getters) => {
    const config = sortConfig[table];
    const getter = getters[config.key];
    if (!getter) return rows;

    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
      const aValue = getter(a.row, a.index);
      const bValue = getter(b.row, b.index);
      const aNumber = Number(aValue);
      const bNumber = Number(bValue);
      const result =
        aValue !== "" &&
        bValue !== "" &&
        !Number.isNaN(aNumber) &&
        !Number.isNaN(bNumber)
          ? aNumber - bNumber
          : String(aValue || "").localeCompare(String(bValue || ""), undefined, { numeric: true, sensitivity: "base" });

      return config.direction === "asc" ? result : -result;
    })
      .map(({ row }) => row);
  };

  const rowNumber = (rows, row) => rows.findIndex((item) => item === row) + 1;

  const changeSort = (table, key) => {
    setSortConfig((prev) => ({
      ...prev,
      [table]: {
        key,
        direction: prev[table]?.key === key && prev[table]?.direction === "asc" ? "desc" : "asc",
      },
    }));
  };

  const sortButton = (table, key, label) => (
    <button type="button" className={sortBtnClass} onClick={() => changeSort(table, key)}>
      <span>{label}</span>
      <span>{sortConfig[table]?.key === key ? (sortConfig[table].direction === "asc" ? "▲" : "▼") : ""}</span>
    </button>
  );

  useEffect(() => {
    setPayments((prev) => {
      let changed = false;
      const next = prev.map((payment) => {
        const student = students.find((s) => Number(s.id) === Number(payment.studentId));
        const fallbackTeacherId = payment.teacherId != null ? payment.teacherId : student?.teacherId != null ? student.teacherId : null;
        const teacher = teachers.find((t) => Number(t.id) === Number(fallbackTeacherId));
        const patched = {
          ...payment,
          studentName: payment.studentName || student?.name || "Pa student",
          teacherId: payment.teacherId != null ? payment.teacherId : student?.teacherId != null ? Number(student.teacherId) : null,
          teacherName: payment.teacherName || teacher?.name || "Pa mësues",
        };
        if (
          patched.studentName !== payment.studentName ||
          patched.teacherId !== payment.teacherId ||
          patched.teacherName !== payment.teacherName
        ) {
          changed = true;
        }
        return patched;
      });
      return changed ? next : prev;
    });

    setArchive((prev) => {
      let changed = false;
      const nextPayments = prev.payments.map((payment) => {
        const student = students.find((s) => Number(s.id) === Number(payment.studentId));
        const fallbackTeacherId = payment.teacherId != null ? payment.teacherId : student?.teacherId != null ? student.teacherId : null;
        const teacher = teachers.find((t) => Number(t.id) === Number(fallbackTeacherId));
        const patched = {
          ...payment,
          studentName: payment.studentName || student?.name || "Pa student",
          teacherId: payment.teacherId != null ? payment.teacherId : student?.teacherId != null ? Number(student.teacherId) : null,
          teacherName: payment.teacherName || teacher?.name || "Pa mësues",
        };
        if (
          patched.studentName !== payment.studentName ||
          patched.teacherId !== payment.teacherId ||
          patched.teacherName !== payment.teacherName
        ) {
          changed = true;
        }
        return patched;
      });
      return changed ? { ...prev, payments: nextPayments } : prev;
    });
  }, [students, teachers, setPayments, setArchive]);

  const addStudent = () => {
    const firstName = studentForm.firstName.trim();
    const lastName = studentForm.lastName.trim();
    if (!firstName || !lastName || !studentForm.course) return;

    setStudents((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        age: studentForm.age.trim(),
        city: studentForm.city.trim(),
        phone: studentForm.phone.trim(),
        email: studentForm.email.trim(),
        course: studentForm.course,
        group: studentForm.group,
        teacherId: studentForm.teacherId ? Number(studentForm.teacherId) : null,
      },
    ]);
    setStudentForm(emptyStudentForm);
    setIsStudentModalOpen(false);
  };

  const importStudentsFromExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const importedStudents = rows
        .map((row, index) => {
          const firstName = getExcelValue(row, ["Emri", "First Name", "FirstName"]);
          const lastName = getExcelValue(row, ["Mbiemri", "Last Name", "LastName"]);
          const fullName = getExcelValue(row, ["Emri dhe mbiemri", "Emri Mbiemri", "Name", "Full Name"]);
          const fallbackParts = fullName.split(" ").filter(Boolean);
          const finalFirstName = firstName || fallbackParts[0] || "";
          const finalLastName = lastName || fallbackParts.slice(1).join(" ");
          const name = [finalFirstName, finalLastName].filter(Boolean).join(" ");
          const teacherName = getExcelValue(row, ["Mesuesi", "Mësuesi", "Teacher"]);
          const teacher = teachers.find((item) => item.name.toLowerCase() === teacherName.toLowerCase());

          if (!name) return null;

          return {
            id: Date.now() + index,
            name,
            firstName: finalFirstName,
            lastName: finalLastName,
            age: getExcelValue(row, ["Mosha", "Age"]),
            city: getExcelValue(row, ["Qyteti", "City"]),
            phone: getExcelValue(row, ["Numri i telefonit", "Telefoni", "Phone", "Phone Number"]),
            email: getExcelValue(row, ["Emaili", "Email", "E-mail"]),
            course: getExcelValue(row, ["Kursi", "Course"]),
            group: getExcelValue(row, ["Grupi", "Group"]),
            teacherId: teacher ? Number(teacher.id) : null,
          };
        })
        .filter(Boolean);

      if (!importedStudents.length) {
        window.alert("Nuk u gjet asnje nxenes per import.");
        return;
      }

      setStudents((prev) => [...prev, ...importedStudents]);
      window.alert(`U importuan ${importedStudents.length} nxenes.`);
    } catch {
      window.alert("Importi deshtoi. Kontrollo formatin e Excel file.");
    } finally {
      event.target.value = "";
    }
  };

  const addTeacher = () => {
    const firstName = teacherForm.firstName.trim();
    const lastName = teacherForm.lastName.trim();
    if (!firstName || !lastName) return;
    setTeachers((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        percent: Number(teacherForm.percent),
      },
    ]);
    setTeacherForm(emptyTeacherForm);
    setIsTeacherModalOpen(false);
  };

  const addCourse = () => {
    if (!courseForm.name.trim() || !courseForm.price) return;
    setCourses((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: courseForm.name.trim(),
        price: parseFloat(courseForm.price),
      },
    ]);
    setCourseForm(emptyCourseForm);
    setIsCourseModalOpen(false);
  };

  const startEditCourse = (course) => {
    setEditingCourseId(course.id);
    setEditingCourseName(course.name);
    setEditingCoursePrice(String(course.price));
  };

  const saveEditCourse = () => {
    if (!editingCourseName.trim() || !editingCoursePrice) return;
    setCourses((prev) =>
      prev.map((course) =>
        course.id === editingCourseId
          ? {
              ...course,
              name: editingCourseName.trim(),
              price: parseFloat(editingCoursePrice),
            }
          : course
      )
    );
    setEditingCourseId(null);
    setEditingCourseName("");
    setEditingCoursePrice("");
  };

  const openPaymentModal = () => {
    setSelectedStudent("");
    setPaymentAmount("");
    setPaymentNote("");
    setPaymentDate(currentDateInput());
    setPaymentTeacherPercent(80);
    setPaymentAdminPercent(15);
    setPaymentSchoolPercent(5);
    setIsPaymentModalOpen(true);
  };

  const changePaymentStudent = (studentId) => {
    setSelectedStudent(studentId);
    const student = students.find((s) => Number(s.id) === Number(studentId));
    const price = student ? getStudentCoursePrice(student) : 0;
    setPaymentAmount(price ? formatExportCurrency(price) : "");
  };

  const addPayment = () => {
    if (!paymentAmount || !selectedStudent) return;
    const student = students.find((s) => Number(s.id) === Number(selectedStudent));
    const teacher = teachers.find((t) => Number(t.id) === Number(student?.teacherId));
    setPayments((prev) => [
      ...prev,
      {
        id: Date.now(),
        studentId: Number(selectedStudent),
        studentName: student?.name || "Pa student",
        teacherId: student?.teacherId != null ? Number(student.teacherId) : null,
        teacherName: teacher?.name || "Pa mësues",
        amount: parseMoney(paymentAmount),
        teacherPercent: Number(paymentTeacherPercent),
        adminPercent: Number(paymentAdminPercent),
        schoolPercent: Number(paymentSchoolPercent),
        note: paymentNote.trim(),
        date: paymentDate ? `${paymentDate}T00:00:00.000Z` : new Date().toISOString(),
      },
    ]);
    setPaymentAmount("");
    setPaymentNote("");
    setSelectedStudent("");
    setPaymentDate(currentDateInput());
    setPaymentTeacherPercent(80);
    setPaymentAdminPercent(15);
    setPaymentSchoolPercent(5);
    setIsPaymentModalOpen(false);
  };

  const openExpenseModal = () => {
    setExpenseName("");
    setExpenseDate(currentDateInput());
    setExpenseAmount("");
    setExpenseNote("");
    setIsExpenseModalOpen(true);
  };

  const addExpense = () => {
    if (!expenseName.trim() || !expenseAmount) return;
    setExpenses((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: expenseName.trim(),
        date: expenseDate || new Date().toISOString(),
        amount: parseFloat(expenseAmount),
        note: expenseNote.trim(),
      },
    ]);
    setExpenseName("");
    setExpenseDate(currentDateInput());
    setExpenseAmount("");
    setExpenseNote("");
    setIsExpenseModalOpen(false);
  };

  const startEditExpense = (expense) => {
    setEditingExpenseId(expense.id);
    setEditingExpenseName(expense.name);
    setEditingExpenseDate(expense.date ? String(expense.date).slice(0, 10) : "");
    setEditingExpenseAmount(String(expense.amount));
    setExpenseNote(expense.note || "");
  };

  const saveEditExpense = () => {
    if (!editingExpenseName.trim() || !editingExpenseAmount) return;
    setExpenses((prev) =>
      prev.map((expense) =>
        expense.id === editingExpenseId
          ? {
              ...expense,
              name: editingExpenseName.trim(),
              date: editingExpenseDate || expense.date,
              amount: parseFloat(editingExpenseAmount),
              note: expenseNote.trim(),
            }
          : expense
      )
    );
    setEditingExpenseId(null);
    setEditingExpenseName("");
    setEditingExpenseDate("");
    setEditingExpenseAmount("");
    setExpenseNote("");
  };

  const archiveStudent = (student) => {
    setArchive((prev) => ({ ...prev, students: [...prev.students, student] }));
    setStudents((prev) => prev.filter((s) => s.id !== student.id));
  };

  const archiveTeacher = (teacher) => {
    setArchive((prev) => ({ ...prev, teachers: [...prev.teachers, teacher] }));
    setTeachers((prev) => prev.filter((t) => t.id !== teacher.id));
  };

  const archivePayment = (payment) => {
    setArchive((prev) => ({ ...prev, payments: [...prev.payments, payment] }));
    setPayments((prev) => prev.filter((p) => p.id !== payment.id));
  };

  const archiveCourse = (course) => {
    setArchive((prev) => ({ ...prev, courses: [...(prev.courses || []), course] }));
    setCourses((prev) => prev.filter((item) => item.id !== course.id));
  };

  const restoreStudent = (student) => {
    setStudents((prev) => [...prev, student]);
    setArchive((prev) => ({ ...prev, students: prev.students.filter((x) => x.id !== student.id) }));
  };

  const restoreTeacher = (teacher) => {
    setTeachers((prev) => [...prev, teacher]);
    setArchive((prev) => ({ ...prev, teachers: prev.teachers.filter((x) => x.id !== teacher.id) }));
  };

  const restorePayment = (payment) => {
    setPayments((prev) => [...prev, payment]);
    setArchive((prev) => ({ ...prev, payments: prev.payments.filter((x) => x.id !== payment.id) }));
  };

  const restoreCourse = (course) => {
    setCourses((prev) => [...prev, course]);
    setArchive((prev) => ({ ...prev, courses: (prev.courses || []).filter((x) => x.id !== course.id) }));
  };

  const startEditStudent = (student) => {
    const nameParts = String(student.name || "").split(" ").filter(Boolean);
    setEditingStudentId(student.id);
    setEditingStudentFirstName(student.firstName || nameParts[0] || "");
    setEditingStudentLastName(student.lastName || nameParts.slice(1).join(" "));
    setEditingStudentAge(student.age || "");
    setEditingStudentCity(student.city || "");
    setEditingStudentPhone(student.phone || "");
    setEditingStudentEmail(student.email || "");
    setEditingStudentCourse(student.course || "");
    setEditingStudentGroup(student.group || "");
    setEditingStudentTeacherId(String(student.teacherId || ""));
  };

  const cancelEditStudent = () => {
    setEditingStudentId(null);
    setEditingStudentFirstName("");
    setEditingStudentLastName("");
    setEditingStudentAge("");
    setEditingStudentCity("");
    setEditingStudentPhone("");
    setEditingStudentEmail("");
    setEditingStudentCourse("");
    setEditingStudentGroup("");
    setEditingStudentTeacherId("");
  };

  const saveEditStudent = () => {
    const firstName = editingStudentFirstName.trim();
    const lastName = editingStudentLastName.trim();
    if (!firstName && !lastName) return;
    setStudents((prev) =>
      prev.map((student) =>
        student.id === editingStudentId
          ? {
              ...student,
              name: [firstName, lastName].filter(Boolean).join(" "),
              firstName,
              lastName,
              age: editingStudentAge.trim(),
              city: editingStudentCity.trim(),
              phone: editingStudentPhone.trim(),
              email: editingStudentEmail.trim(),
              course: editingStudentCourse,
              group: editingStudentGroup,
              teacherId: editingStudentTeacherId ? Number(editingStudentTeacherId) : null,
            }
          : student
      )
    );
    cancelEditStudent();
  };

  const startEditTeacher = (teacher) => {
    const nameParts = String(teacher.name || "").split(" ").filter(Boolean);
    setEditingTeacherId(teacher.id);
    setEditingTeacherFirstName(teacher.firstName || nameParts[0] || "");
    setEditingTeacherLastName(teacher.lastName || nameParts.slice(1).join(" "));
    setEditingTeacherPercent(teacher.percent);
  };

  const saveEditTeacher = () => {
    const firstName = editingTeacherFirstName.trim();
    const lastName = editingTeacherLastName.trim();
    if (!firstName && !lastName) return;
    setTeachers((prev) =>
      prev.map((teacher) =>
        teacher.id === editingTeacherId
          ? {
              ...teacher,
              name: [firstName, lastName].filter(Boolean).join(" "),
              firstName,
              lastName,
              percent: Number(editingTeacherPercent),
            }
          : teacher
      )
    );
    setEditingTeacherId(null);
    setEditingTeacherFirstName("");
    setEditingTeacherLastName("");
    setEditingTeacherPercent(80);
  };

  const openAssignStudentsModal = () => {
    const initialTeacherId = selectedTeacherView || teachers[0]?.id || "";
    setAssignTeacherId(initialTeacherId ? String(initialTeacherId) : "");
    setAssignStudentIds(
      initialTeacherId
        ? students.filter((student) => Number(student.teacherId) === Number(initialTeacherId)).map((student) => Number(student.id))
        : []
    );
    setIsAssignStudentsModalOpen(true);
  };

  const changeAssignTeacher = (teacherId) => {
    setAssignTeacherId(teacherId);
    setAssignStudentIds(
      teacherId
        ? students.filter((student) => Number(student.teacherId) === Number(teacherId)).map((student) => Number(student.id))
        : []
    );
  };

  const toggleAssignStudent = (studentId) => {
    setAssignStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const saveAssignedStudents = () => {
    if (!assignTeacherId) return;
    setStudents((prev) =>
      prev.map((student) => {
        const isSelected = assignStudentIds.includes(Number(student.id));
        const belongsToTeacher = Number(student.teacherId) === Number(assignTeacherId);

        if (isSelected) {
          return { ...student, teacherId: Number(assignTeacherId) };
        }

        if (belongsToTeacher) {
          return { ...student, teacherId: null };
        }

        return student;
      })
    );
    setSelectedTeacherView(Number(assignTeacherId));
    setIsAssignStudentsModalOpen(false);
  };

  const startEditPayment = (payment) => {
    setEditingPaymentId(payment.id);
    setEditingPaymentAmount(String(payment.amount));
    setEditingPaymentStudentId(String(payment.studentId));
    setEditingPaymentDate(payment.date ? String(payment.date).slice(0, 10) : "");
    setEditingPaymentNote(payment.note || "");
  };

  const saveEditPayment = () => {
    if (!editingPaymentAmount || !editingPaymentStudentId || !editingPaymentDate) return;
    const student = students.find((s) => Number(s.id) === Number(editingPaymentStudentId));
    const teacher = teachers.find((t) => Number(t.id) === Number(student?.teacherId));
    setPayments((prev) =>
      prev.map((payment) =>
        payment.id === editingPaymentId
          ? {
              ...payment,
              amount: parseMoney(editingPaymentAmount),
              studentId: Number(editingPaymentStudentId),
              studentName: student?.name || payment.studentName || "Pa student",
              teacherId: student?.teacherId != null ? Number(student.teacherId) : null,
              teacherName: teacher?.name || payment.teacherName || "Pa mësues",
              note: editingPaymentNote.trim(),
              date: `${editingPaymentDate}T00:00:00.000Z`,
            }
          : payment
      )
    );
    setEditingPaymentId(null);
    setEditingPaymentAmount("");
    setEditingPaymentStudentId("");
    setEditingPaymentDate("");
    setEditingPaymentNote("");
  };

  const currentPaymentMonth = monthFromDate(new Date().toISOString());

  const getStudentCourse = (student) => courses.find((course) => course.name === student.course);
  const getStudentCoursePrice = (student) => Number(getStudentCourse(student)?.price || 0);
  const getStudentCurrentPayments = (student) =>
    payments.filter(
      (payment) =>
        Number(payment.studentId) === Number(student.id) &&
        monthFromDate(payment.date) === currentPaymentMonth
    );
  const hasStudentCurrentPayment = (student) => getStudentCurrentPayments(student).length > 0;
  const paymentTeacherPercentValue = (payment, teacher) => Number(payment.teacherPercent ?? teacher?.percent ?? 80);
  const paymentAdminPercentValue = (payment) => Number(payment.adminPercent ?? 15);
  const paymentSchoolPercentValue = (payment) => Number(payment.schoolPercent ?? 5);

  const toggleStudentPayment = (student) => {
    if (hasStudentCurrentPayment(student)) {
      setPayments((prev) =>
        prev.filter(
          (payment) =>
            Number(payment.studentId) !== Number(student.id) ||
            monthFromDate(payment.date) !== currentPaymentMonth
        )
      );
      return;
    }

    const course = getStudentCourse(student);
    if (!course) {
      window.alert("Ky kurs nuk ka cmim te caktuar te Kurset.");
      return;
    }

    const teacher = teachers.find((t) => Number(t.id) === Number(student.teacherId));
    setPayments((prev) => [
      ...prev,
      {
        id: Date.now(),
        studentId: Number(student.id),
        studentName: student.name || "Pa student",
        teacherId: student.teacherId != null ? Number(student.teacherId) : null,
        teacherName: teacher?.name || "Pa mesues",
        amount: getStudentCoursePrice(student),
        teacherPercent: 80,
        adminPercent: 15,
        schoolPercent: 5,
        date: new Date().toISOString(),
      },
    ]);
  };

  const filteredStudents = students.filter((student) => {
    const teacher = teachers.find((t) => Number(t.id) === Number(student.teacherId));
    const q = studentSearch.trim().toLowerCase();
    if (!q) return true;
    return [
      student.name,
      student.firstName,
      student.lastName,
      student.age,
      student.city,
      student.phone,
      student.email,
      student.course,
      formatMonthYear(student.group),
      teacher?.name,
    ].some((value) => String(value || "").toLowerCase().includes(q));
  });
  const filteredStudentsByGroup = filteredStudents.filter((student) =>
    studentGroupFilter ? student.group === studentGroupFilter : true
  );

  const selectedTeacherStudents = students.filter(
    (student) => Number(student.teacherId) === Number(selectedTeacherView)
  );
  const sortedSelectedTeacherStudents = sortRows(selectedTeacherStudents, "selectedTeacherStudents", {
    nr: (_student, index) => index + 1,
    name: (student) => student.firstName || student.name,
    lastName: (student) => student.lastName,
    course: (student) => student.course,
  });

  const activePaymentTeacherFilter = paymentTeacherFilter && teachers.some((t) => t.name === paymentTeacherFilter) ? paymentTeacherFilter : "";
  const activeFinanceTeacherFilter = financeTeacherFilter && teachers.some((t) => t.name === financeTeacherFilter) ? financeTeacherFilter : "";

  const enrichedPayments = payments.map((payment) => {
    const student = students.find((s) => Number(s.id) === Number(payment.studentId));
    const fallbackTeacherId = payment.teacherId != null ? payment.teacherId : student?.teacherId != null ? student.teacherId : null;
    const teacher = teachers.find((t) => Number(t.id) === Number(fallbackTeacherId));
    return {
      ...payment,
      studentName: payment.studentName || student?.name || "Pa student",
      teacherName: payment.teacherName || teacher?.name || "Pa mësues",
      month: monthFromDate(payment.date),
    };
  });

  const filteredPayments = enrichedPayments.filter((payment) => {
    const q = paymentSearch.trim().toLowerCase();
    const matchesSearch = !q
      ? true
      : payment.studentName.toLowerCase().includes(q) ||
        payment.teacherName.toLowerCase().includes(q) ||
        String(payment.amount).includes(q) ||
        String(payment.note || "").toLowerCase().includes(q) ||
        payment.month.includes(q) ||
        formatDateDisplay(payment.date).includes(q);

    const matchesTeacher = !activePaymentTeacherFilter ? true : payment.teacherName === activePaymentTeacherFilter;
    return matchesSearch && matchesTeacher;
  });

  const filteredExpenses = expenses.filter((expense) => {
    const matchesMonth = !expenseMonthFilter ? true : monthFromDate(expense.date) === expenseMonthFilter;
    return matchesMonth;
  });

  const filteredCourses = courses.filter((course) => {
    const q = courseSearch.trim().toLowerCase();
    return !q || course.name.toLowerCase().includes(q) || String(course.price).includes(q);
  });

  const teacherEarnings = useMemo(() => {
    return teachers
      .filter((teacher) => !activeFinanceTeacherFilter || teacher.name === activeFinanceTeacherFilter)
      .map((teacher) => {
        const teacherStudents = students.filter((student) => Number(student.teacherId) === Number(teacher.id));
        const teacherStudentIds = teacherStudents.map((student) => Number(student.id));
        const relevantPayments = payments.filter((payment) => {
          const sameTeacher = teacherStudentIds.includes(Number(payment.studentId));
          const sameMonth = financeMonth ? monthFromDate(payment.date) === financeMonth : true;
          return sameTeacher && sameMonth;
        });

        const total = relevantPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const teacherShare = relevantPayments.reduce(
          (sum, payment) => sum + Number(payment.amount || 0) * (paymentTeacherPercentValue(payment, teacher) / 100),
          0
        );
        const adminShare = relevantPayments.reduce(
          (sum, payment) => sum + Number(payment.amount || 0) * (paymentAdminPercentValue(payment) / 100),
          0
        );
        const schoolShare = relevantPayments.reduce(
          (sum, payment) => sum + Number(payment.amount || 0) * (paymentSchoolPercentValue(payment) / 100),
          0
        );
        const remainingShare = total - teacherShare - adminShare - schoolShare;

        return {
          ...teacher,
          studentsCount: teacherStudents.length,
          total,
          teacherShare,
          adminShare,
          schoolShare,
          remainingShare,
        };
      });
  }, [teachers, students, payments, financeMonth, activeFinanceTeacherFilter]);

  const filteredArchiveStudents = archive.students.filter((student) => {
    const q = archiveSearch.trim().toLowerCase();
    return !q || [
      student.name,
      student.firstName,
      student.lastName,
      student.age,
      student.city,
      student.phone,
      student.email,
      student.course,
    ].some((value) => String(value || "").toLowerCase().includes(q));
  });

  const filteredArchiveTeachers = archive.teachers.filter((teacher) => {
    const q = archiveSearch.trim().toLowerCase();
    return !q || teacher.name.toLowerCase().includes(q);
  });

  const filteredArchivePayments = archive.payments.filter((payment) => {
    const q = archiveSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (payment.studentName || "").toLowerCase().includes(q) ||
      (payment.teacherName || "").toLowerCase().includes(q) ||
      String(payment.amount).includes(q) ||
      monthFromDate(payment.date).includes(q) ||
      formatDateDisplay(payment.date).includes(q)
    );
  });

  const filteredArchiveCourses = (archive.courses || []).filter((course) => {
    const q = archiveSearch.trim().toLowerCase();
    return !q || course.name.toLowerCase().includes(q) || String(course.price).includes(q);
  });

  const sortedStudents = sortRows(filteredStudentsByGroup, "students", {
    nr: (_student, index) => index + 1,
    firstName: (student) => student.firstName || student.name,
    lastName: (student) => student.lastName,
    age: (student) => student.age,
    city: (student) => student.city,
    course: (student) => student.course,
    group: (student) => student.group,
    teacherName: (student) => teachers.find((teacher) => Number(teacher.id) === Number(student.teacherId))?.name || "Pa mesues",
    payment: (student) => (hasStudentCurrentPayment(student) ? 1 : 0),
  });

  const filteredTeachers = teachers.filter((teacher) => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return true;
    const teacherStudents = students.filter((student) => Number(student.teacherId) === Number(teacher.id));
    return (
      teacher.name.toLowerCase().includes(q) ||
      (teacher.firstName || "").toLowerCase().includes(q) ||
      (teacher.lastName || "").toLowerCase().includes(q) ||
      String(teacher.percent).includes(q) ||
      String(teacherStudents.length).includes(q)
    );
  });

  const sortedTeachers = sortRows(filteredTeachers, "teachers", {
    nr: (_teacher, index) => index + 1,
    name: (teacher) => teacher.firstName || teacher.name,
    lastName: (teacher) => teacher.lastName,
    studentsCount: (teacher) => students.filter((student) => Number(student.teacherId) === Number(teacher.id)).length,
  });

  const sortedPayments = sortRows(filteredPayments, "payments", {
    nr: (_payment, index) => index + 1,
    studentName: (payment) => payment.studentName,
    teacherName: (payment) => payment.teacherName,
    amount: (payment) => payment.amount,
    date: (payment) => new Date(payment.date).getTime(),
    note: (payment) => payment.note,
  });

  const sortedTeacherEarnings = sortRows(teacherEarnings, "paga", {
    nr: (_teacher, index) => index + 1,
    name: (teacher) => teacher.name,
    studentsCount: (teacher) => teacher.studentsCount,
    total: (teacher) => teacher.total,
    teacherShare: (teacher) => teacher.teacherShare,
    adminShare: (teacher) => teacher.adminShare,
    schoolShare: (teacher) => teacher.schoolShare,
    remainingShare: (teacher) => teacher.remainingShare,
  });

  const financePaymentRows = payments
    .map((payment) => {
      const student = students.find((item) => Number(item.id) === Number(payment.studentId));
      const fallbackTeacherId = payment.teacherId != null ? payment.teacherId : student?.teacherId;
      const teacher = teachers.find((item) => Number(item.id) === Number(fallbackTeacherId));
      if (!teacher) return null;
      if (financeMonth && monthFromDate(payment.date) !== financeMonth) return null;
      if (activeFinanceTeacherFilter && teacher.name !== activeFinanceTeacherFilter) return null;

      return {
        teacherName: teacher.name,
        studentName: payment.studentName || student?.name || "Pa student",
        teacherPayment: Number(payment.amount || 0) * (paymentTeacherPercentValue(payment, teacher) / 100),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const teacherSort = a.teacherName.localeCompare(b.teacherName, undefined, { sensitivity: "base" });
      return teacherSort || a.studentName.localeCompare(b.studentName, undefined, { sensitivity: "base" });
    });

  const financeExportTotal = financePaymentRows.reduce((sum, row) => sum + row.teacherPayment, 0);
  const overviewPayments = payments.filter((payment) => monthFromDate(payment.date) === financeOverviewMonth);
  const overviewIncome = overviewPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const overviewTeacherPay = overviewPayments.reduce((sum, payment) => {
    const student = students.find((item) => Number(item.id) === Number(payment.studentId));
    const fallbackTeacherId = payment.teacherId != null ? payment.teacherId : student?.teacherId;
    const teacher = teachers.find((item) => Number(item.id) === Number(fallbackTeacherId));
    return sum + Number(payment.amount || 0) * (paymentTeacherPercentValue(payment, teacher) / 100);
  }, 0);
  const overviewSchoolShare = overviewPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0) * (paymentSchoolPercentValue(payment) / 100),
    0
  );
  const overviewExpenses = expenses
    .filter((expense) => monthFromDate(expense.date) === financeOverviewMonth)
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const overviewProfit = overviewSchoolShare - overviewExpenses;

  const sortedExpenses = sortRows(filteredExpenses, "finance", {
    nr: (_expense, index) => index + 1,
    name: (expense) => expense.name,
    date: (expense) => new Date(expense.date).getTime(),
    amount: (expense) => expense.amount,
  });

  const sortedCourses = sortRows(filteredCourses, "courses", {
    nr: (_course, index) => index + 1,
    name: (course) => course.name,
    price: (course) => course.price,
  });

  const sortedArchiveCourses = sortRows(filteredArchiveCourses, "courses", {
    nr: (_course, index) => index + 1,
    name: (course) => course.name,
    price: (course) => course.price,
  });

  const sortedArchiveStudents = sortRows(filteredArchiveStudents, "archive", {
    nr: (_student, index) => index + 1,
    name: (student) => student.name,
    teacherName: (student) => teachers.find((teacher) => Number(teacher.id) === Number(student.teacherId))?.name || "Pa mesues",
  });

  const sortedArchiveTeachers = sortRows(filteredArchiveTeachers, "archive", {
    nr: (_teacher, index) => index + 1,
    name: (teacher) => teacher.name,
  });

  const sortedArchivePayments = sortRows(filteredArchivePayments, "archive", {
    nr: (_payment, index) => index + 1,
    name: (payment) => payment.studentName || "Pa student",
    teacherName: (payment) => payment.teacherName || "Pa mesues",
  });

  const toggleArchiveSelection = (type, id) => {
    setArchiveSelection((prev) => ({
      ...prev,
      [type]: (prev[type] || []).includes(id)
        ? (prev[type] || []).filter((itemId) => itemId !== id)
        : [...(prev[type] || []), id],
    }));
  };

  const bulkRestore = (type) => {
    const ids = archiveSelection[type] || [];
    if (!ids.length) return;

    if (type === "students") {
      const items = archive.students.filter((item) => ids.includes(item.id));
      setStudents((prev) => [...prev, ...items]);
      setArchive((prev) => ({ ...prev, students: prev.students.filter((item) => !ids.includes(item.id)) }));
    }

    if (type === "teachers") {
      const items = archive.teachers.filter((item) => ids.includes(item.id));
      setTeachers((prev) => [...prev, ...items]);
      setArchive((prev) => ({ ...prev, teachers: prev.teachers.filter((item) => !ids.includes(item.id)) }));
    }

    if (type === "payments") {
      const items = archive.payments.filter((item) => ids.includes(item.id));
      setPayments((prev) => [...prev, ...items]);
      setArchive((prev) => ({ ...prev, payments: prev.payments.filter((item) => !ids.includes(item.id)) }));
    }

    if (type === "courses") {
      const items = (archive.courses || []).filter((item) => ids.includes(item.id));
      setCourses((prev) => [...prev, ...items]);
      setArchive((prev) => ({ ...prev, courses: (prev.courses || []).filter((item) => !ids.includes(item.id)) }));
    }

    setArchiveSelection((prev) => ({ ...prev, [type]: [] }));
  };

  const deleteArchivedItem = (type, id) => {
    if (!window.confirm("A je i sigurt që don me e fshi përgjithmonë?")) return;
    setArchive((prev) => ({ ...prev, [type]: (prev[type] || []).filter((item) => item.id !== id) }));
    setArchiveSelection((prev) => ({ ...prev, [type]: prev[type].filter((itemId) => itemId !== id) }));
  };

  const bulkDeleteArchived = (type) => {
    if (!window.confirm("A je i sigurt që don me i fshi këto përgjithmonë?")) return;
    const ids = archiveSelection[type] || [];
    if (!ids.length) return;
    setArchive((prev) => ({ ...prev, [type]: (prev[type] || []).filter((item) => !ids.includes(item.id)) }));
    setArchiveSelection((prev) => ({ ...prev, [type]: [] }));
  };

  const openFinanceExportNoteModal = (type) => {
    setPendingFinanceExportType(type);
    setFinanceExportNote("");
    setIsFinanceExportNoteModalOpen(true);
  };

  const submitFinanceExportNote = () => {
    if (pendingFinanceExportType === "excel") exportFinanceExcel(financeExportNote);
    if (pendingFinanceExportType === "pdf") exportFinancePdf(financeExportNote);
    setIsFinanceExportNoteModalOpen(false);
    setPendingFinanceExportType("");
    setFinanceExportNote("");
  };

  const buildFinanceExportRows = (note = "") => [
    ...(activeFinanceTeacherFilter
      ? [
          [activeFinanceTeacherFilter, "", ""],
          ["Nxënësi", "Pagesa", "Shenime"],
          ...financePaymentRows.map((row) => [row.studentName, formatExportCurrency(row.teacherPayment), note]),
          ["", formatExportCurrency(financeExportTotal), ""],
        ]
      : [
          ["Mësuesi", "Nxënësi", "Pagesa", "Shenime"],
          ...financePaymentRows.map((row) => [row.teacherName, row.studentName, formatExportCurrency(row.teacherPayment), note]),
          ["", "", formatExportCurrency(financeExportTotal), ""],
        ]),
  ];

  const exportFinanceExcel = (note = "") => {
    const rows = buildFinanceExportRows(note);
    const tableRows = rows
      .map((row, rowIndex) => {
        if (activeFinanceTeacherFilter && rowIndex === 0) {
          return `<tr><td colspan="2" class="first-row merged">${escapeHtml(row[0])}</td><td></td></tr>`;
        }

        const cellTag = rowIndex === 0 || (activeFinanceTeacherFilter && rowIndex === 1) ? "th" : "td";
        return `<tr>${row.map((cell) => `<${cellTag}>${escapeHtml(cell)}</${cellTag}>`).join("")}</tr>`;
      })
      .join("");
    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            table { border-collapse: collapse; width: auto; table-layout: auto; }
            th, td { border: 1px solid #000; padding: 4px 8px; white-space: nowrap; }
            th, .first-row { font-weight: bold; }
            .merged { text-align: center; }
          </style>
        </head>
        <body><table>${tableRows}</table></body>
      </html>
    `;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const suffix = activeFinanceTeacherFilter ? activeFinanceTeacherFilter.replace(/\s+/g, "_") : "te_gjithe";
    link.href = url;
    link.download = `financa_${suffix}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportFinancePdf = (note = "") => {
    const doc = new jsPDF({ orientation: "landscape" });
    const title = activeFinanceTeacherFilter ? `Financa - ${activeFinanceTeacherFilter}` : "Financa - Te gjithe mesuesit";
    doc.setFontSize(14);
    doc.text(title, 14, 15);

    if (activeFinanceTeacherFilter) {
      autoTable(doc, {
        startY: 22,
        theme: "grid",
        tableWidth: "auto",
        styles: { lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { fontStyle: "bold" },
        head: [
          [{ content: activeFinanceTeacherFilter, colSpan: 3, styles: { fontStyle: "bold", halign: "center" } }],
          ["Nxënësi", "Pagesa", "Shenime"],
        ],
        body: [
          ...financePaymentRows.map((row) => [row.studentName, formatExportCurrency(row.teacherPayment), note]),
          ["", formatExportCurrency(financeExportTotal), ""],
        ],
      });
    } else {
      autoTable(doc, {
        startY: 22,
        theme: "grid",
        tableWidth: "auto",
        styles: { lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { fontStyle: "bold" },
        head: [["Mësuesi", "Nxënësi", "Pagesa", "Shenime"]],
        body: [
          ...financePaymentRows.map((row) => [row.teacherName, row.studentName, formatExportCurrency(row.teacherPayment), note]),
          ["", "", formatExportCurrency(financeExportTotal), ""],
        ],
      });
    }

    const suffix = activeFinanceTeacherFilter ? activeFinanceTeacherFilter.replace(/\s+/g, "_") : "te_gjithe";
    doc.save(`financa_${suffix}.pdf`);
  };

  const buildExpenseExportRows = () => [
    ["Produkti", "Data", "Cmimi", "Shenime"],
    ...filteredExpenses.map((expense) => [expense.name, formatDateDisplay(expense.date), formatExportCurrency(expense.amount), expense.note || ""]),
  ];

  const exportExpensesExcel = () => {
    const rows = buildExpenseExportRows();
    const tableRows = rows
      .map((row, rowIndex) => {
        const cellTag = rowIndex === 0 ? "th" : "td";
        return `<tr>${row.map((cell) => `<${cellTag}>${escapeHtml(cell)}</${cellTag}>`).join("")}</tr>`;
      })
      .join("");
    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            table { border-collapse: collapse; width: auto; table-layout: auto; }
            th, td { border: 1px solid #000; padding: 4px 8px; white-space: nowrap; }
            th { font-weight: bold; }
          </style>
        </head>
        <body><table>${tableRows}</table></body>
      </html>
    `;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const suffix = expenseMonthFilter || "te_gjitha";
    link.href = url;
    link.download = `shpenzime_${suffix}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportExpensesPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const title = expenseMonthFilter ? `Shpenzime - ${expenseMonthFilter}` : "Shpenzime - Te gjitha";
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    autoTable(doc, {
      startY: 22,
      theme: "grid",
      tableWidth: "auto",
      styles: { lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fontStyle: "bold" },
      head: [["Produkti", "Data", "Cmimi", "Shenime"]],
      body: filteredExpenses.map((expense) => [
        expense.name,
        formatDateDisplay(expense.date),
        formatExportCurrency(expense.amount),
        expense.note || "",
      ]),
    });
    const suffix = expenseMonthFilter || "te_gjitha";
    doc.save(`shpenzime_${suffix}.pdf`);
  };

  const navItems = [
    { key: "students", label: "Nxënësit" },
    { key: "teachers", label: "Mësuesit" },
    { key: "payments", label: "Pagesat" },
    { key: "paga", label: "Paga" },
    { key: "finance", label: "Financa" },
    { key: "courses", label: "Kurset" },
    { key: "archive", label: "Archive" },
  ];

  return (
    <div className={`${shell} h-dvh min-h-screen overflow-hidden flex flex-col lg:flex-row`} style={{ background: HIGHLIGHT }}>
      <aside className={`relative w-full ${isSidebarCollapsed ? "lg:w-20" : "lg:w-64"} lg:h-full shrink-0 border-b lg:border-b-0 lg:border-r ${sidebar} p-3 sm:p-4 flex flex-col sticky top-0 z-40 transition-all duration-200`} style={{ background: PRIMARY }}>
        <div className="flex-1">
          <div className={`flex items-center justify-center gap-3 mb-3 lg:mb-6 ${isSidebarCollapsed ? "lg:justify-center" : "lg:justify-start"}`}>
            <BrandMark />
            <div className={`text-base sm:text-lg font-bold leading-tight text-white ${isSidebarCollapsed ? "lg:hidden" : ""}`}>
              Vatra e Dituris&euml;
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="mb-3 hidden h-10 w-full items-center justify-start rounded-lg px-3 transition hover:bg-white/10 lg:flex"
            aria-label={isSidebarCollapsed ? "Hap sidebar" : "Mbyll sidebar"}
            title={isSidebarCollapsed ? "Hap sidebar" : "Mbyll sidebar"}
          >
            <img
              src={sidebarIcon}
              alt=""
              className="h-5 w-5"
            />
          </button>
          <div className={`${isSidebarCollapsed ? "hidden lg:block" : "flex"} flex-wrap justify-center gap-2 lg:block lg:space-y-2`}>
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key)}
                className={`w-[calc(50%-0.25rem)] px-3 py-2 rounded-lg text-center text-sm transition hover:bg-white/10 sm:w-[calc(33.333%-0.34rem)] sm:text-base lg:w-full ${isSidebarCollapsed ? "lg:text-center" : "lg:text-left"}`}
                style={activeView === item.key ? activeNavStyle : inactiveNavStyle}
                title={item.label}
              >
                <span className={isSidebarCollapsed ? "lg:hidden" : ""}>{item.label}</span>
                <span className={`hidden ${isSidebarCollapsed ? "lg:inline" : ""}`}>{item.label.slice(0, 1)}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="mt-3 flex h-10 w-full items-center justify-center rounded-lg transition hover:bg-white/10 lg:hidden"
            aria-label={isSidebarCollapsed ? "Hap sidebar" : "Mbyll sidebar"}
            title={isSidebarCollapsed ? "Hap sidebar" : "Mbyll sidebar"}
          >
            <img
              src={sidebarIcon}
              alt=""
              className="h-5 w-5"
            />
          </button>
        </div>
      </aside>

      <main className="flex-1 min-h-0 p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 overflow-auto">
        {activeView === "students" && (
          <div className={`border rounded-lg lg:rounded-2xl shadow-sm ${card} p-3 sm:p-4`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: PRIMARY }}>Nxënësit</h2>
                <p className="text-gray-500">Menaxho nxënësit dhe mësuesin përkatës.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-[44rem]">
                {searchField({
                  value: studentSearch,
                  onChange: (e) => setStudentSearch(e.target.value),
                  placeholder: "Kërko sipas emrit ose mësuesit",
                })}
                <input className={dateInput} type="month" value={studentGroupFilter} onChange={(e) => setStudentGroupFilter(e.target.value)} />
                <button onClick={() => setStudentGroupFilter("")} className={mainBtn} style={secondaryBtnStyle}>
                  {actionLabel("clear", "Pastro filtrin")}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 mb-6">
              <input
                ref={studentImportRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={importStudentsFromExcel}
              />
              <button onClick={() => studentImportRef.current?.click()} className={mainBtn} style={secondaryBtnStyle}>{actionLabel("import", "Importo nxënës")}</button>
              <button onClick={() => setIsStudentModalOpen(true)} className={mainBtn} style={primaryBtnStyle}>{actionLabel("add", "Shto nxënës")}</button>
            </div>

            <div className={tableWrap}>
              <table className="min-w-[76rem] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={thClass}>{sortButton("students", "nr", "Nr")}</th>
                    <th className={thClass}>{sortButton("students", "firstName", "Emri")}</th>
                    <th className={thClass}>{sortButton("students", "lastName", "Mbiemri")}</th>
                    <th className={thClass}>{sortButton("students", "age", "Mosha")}</th>
                    <th className={thClass}>{sortButton("students", "city", "Qyteti")}</th>
                    <th className={thClass}>Telefoni</th>
                    <th className={thClass}>Emaili</th>
                    <th className={thClass}>{sortButton("students", "course", "Kursi")}</th>
                    <th className={thClass}>{sortButton("students", "group", "Grupi")}</th>
                    <th className={thClass}>{sortButton("students", "payment", "Pagesa")}</th>
                    <th className={thClass}>{sortButton("students", "teacherName", "Mësuesi")}</th>
                    <th className={thClass}>Veprime</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((student) => {
                    const teacher = teachers.find((t) => Number(t.id) === Number(student.teacherId));
                    const isSelected = selectedStudentView === student.id;
                    const isEditing = editingStudentId === student.id;
                    const hasPayment = hasStudentCurrentPayment(student);
                    return (
                      <tr key={student.id} onClick={() => setSelectedStudentView((prev) => (prev === student.id ? null : student.id))} className={`${rowHover} cursor-pointer ${isSelected ? selectedRow : ""}`}>
                        <td className={tdClass}>{rowNumber(filteredStudentsByGroup, student)}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingStudentFirstName} onChange={(e) => setEditingStudentFirstName(e.target.value)} /> : (student.firstName || student.name)}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingStudentLastName} onChange={(e) => setEditingStudentLastName(e.target.value)} /> : (student.lastName || "-")}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingStudentAge} onChange={(e) => setEditingStudentAge(e.target.value)} type="number" min="0" /> : (student.age || "-")}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingStudentCity} onChange={(e) => setEditingStudentCity(e.target.value)} /> : (student.city || "-")}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingStudentPhone} onChange={(e) => setEditingStudentPhone(e.target.value)} /> : (student.phone || "-")}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingStudentEmail} onChange={(e) => setEditingStudentEmail(e.target.value)} type="email" /> : (student.email || "-")}</td>
                        <td className={tdClass}>{isEditing ? (
                          <select className={input} value={editingStudentCourse} onChange={(e) => setEditingStudentCourse(e.target.value)}>
                            <option value="">Zgjedh kursin</option>
                            {editingStudentCourse && !courses.some((course) => course.name === editingStudentCourse) && (
                              <option value={editingStudentCourse}>{editingStudentCourse}</option>
                            )}
                            {courses.map((course) => (
                              <option key={course.id} value={course.name}>{course.name}</option>
                            ))}
                          </select>
                        ) : (student.course || "-")}</td>
                        <td className={tdClass}>{isEditing ? <input className={dateInput} type="month" value={editingStudentGroup} onChange={(e) => setEditingStudentGroup(e.target.value)} /> : formatMonthYear(student.group)}</td>
                        <td className={tdClass}>
                          {hasPayment && !isEditing ? (
                            <img
                              src={doneIcon}
                              alt="E paguar"
                              className="h-5 w-5"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={hasPayment}
                              onChange={() => toggleStudentPayment(student)}
                              onClick={(e) => e.stopPropagation()}
                              className={roundCheckbox}
                            />
                          )}
                        </td>
                        <td className={tdClass}>
                          {isEditing ? (
                            <select className={input} value={editingStudentTeacherId} onChange={(e) => setEditingStudentTeacherId(e.target.value)}>
                              <option value="">Zgjedh mësuesin</option>
                              {teachers.map((teacherOption) => (
                                <option key={teacherOption.id} value={teacherOption.id}>{teacherOption.name}</option>
                              ))}
                            </select>
                          ) : (teacher?.name || "Pa mësues")}
                        </td>
                        <td className={tdClass}>
                          <div className="flex flex-wrap gap-2">
                            {isEditing ? (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); saveEditStudent(); }} className={smallBtn} style={primaryBtnStyle}>Save</button>
                                <button onClick={(e) => { e.stopPropagation(); cancelEditStudent(); }} className={smallBtn} style={secondaryBtnStyle}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); startEditStudent(student); }} className={smallBtn} style={secondaryBtnStyle}>{actionLabel("edit", "Edit")}</button>
                                <button onClick={(e) => { e.stopPropagation(); archiveStudent(student); }} className={smallBtn} style={warningBtnStyle}>{actionLabel("archive", "Archive")}</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeView === "teachers" && (
          <div className={`border rounded-lg lg:rounded-2xl shadow-sm ${card} p-3 sm:p-4`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: PRIMARY }}>Mësuesit</h2>
                <p className="text-gray-500">Kliko një mësues për t’i parë nxënësit e tij poshtë.</p>
              </div>
              <div className="w-full lg:w-80">
                {searchField({
                  value: teacherSearch,
                  onChange: (e) => setTeacherSearch(e.target.value),
                  placeholder: "Kërko sipas emrit ose nxënësve",
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 mb-6">
              <button
                onClick={openAssignStudentsModal}
                disabled={!teachers.length}
                className={mainBtn}
                style={teachers.length ? primaryBtnStyle : disabledPrimaryBtnStyle}
              >
                {actionLabel("assign", "Cakto nxënësit")}
              </button>
              <button onClick={() => setIsTeacherModalOpen(true)} className={mainBtn} style={secondaryBtnStyle}>{actionLabel("add", "Shto mësues")}</button>
            </div>

            <div className={tableWrap}>
              <table className="min-w-[50rem] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={thClass}>{sortButton("teachers", "nr", "Nr")}</th>
                    <th className={thClass}>{sortButton("teachers", "name", "Emri")}</th>
                    <th className={thClass}>{sortButton("teachers", "lastName", "Mbiemri")}</th>
                    <th className={thClass}>Përqindja</th>
                    <th className={thClass}>{sortButton("teachers", "studentsCount", "Nxënës")}</th>
                    <th className={thClass}>Veprime</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTeachers.map((teacher) => {
                    const isSelected = selectedTeacherView === teacher.id;
                    const isEditing = editingTeacherId === teacher.id;
                    const countStudents = students.filter((student) => Number(student.teacherId) === Number(teacher.id)).length;
                    return (
                      <tr key={teacher.id} onClick={() => setSelectedTeacherView((prev) => (prev === teacher.id ? null : teacher.id))} className={`${rowHover} cursor-pointer ${isSelected ? selectedRow : ""}`}>
                        <td className={tdClass}>{rowNumber(filteredTeachers, teacher)}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingTeacherFirstName} onChange={(e) => setEditingTeacherFirstName(e.target.value)} /> : (teacher.firstName || teacher.name)}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingTeacherLastName} onChange={(e) => setEditingTeacherLastName(e.target.value)} /> : (teacher.lastName || "-")}</td>
                        <td className={tdClass}>{isEditing ? (
                          <select className={input} value={editingTeacherPercent} onChange={(e) => setEditingTeacherPercent(e.target.value)}>
                            {percentOptions.map((percent) => (
                              <option key={percent} value={percent}>{percent}%</option>
                            ))}
                          </select>
                        ) : `${teacher.percent}%`}</td>
                        <td className={tdClass}>{countStudents}</td>
                        <td className={tdClass}>
                          <div className="flex flex-wrap gap-2">
                            {isEditing ? (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); saveEditTeacher(); }} className={smallBtn} style={primaryBtnStyle}>Save</button>
                                <button onClick={(e) => { e.stopPropagation(); setEditingTeacherId(null); }} className={smallBtn} style={secondaryBtnStyle}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); startEditTeacher(teacher); }} className={smallBtn} style={secondaryBtnStyle}>{actionLabel("edit", "Edit")}</button>
                                <button onClick={(e) => { e.stopPropagation(); archiveTeacher(teacher); }} className={smallBtn} style={warningBtnStyle}>{actionLabel("archive", "Archive")}</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selectedTeacherView && (
              <div className="mt-6 border rounded-lg lg:rounded-2xl p-3 sm:p-4 bg-gray-50 border-gray-200">
                <h3 className="text-lg font-bold mb-3" style={{ color: PRIMARY }}>Nxënësit e mësuesit të zgjedhur</h3>
                <div className={tableWrap}>
                  <table className="min-w-[36rem] w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className={thClass}>{sortButton("selectedTeacherStudents", "nr", "Nr")}</th>
                        <th className={thClass}>{sortButton("selectedTeacherStudents", "name", "Emri")}</th>
                        <th className={thClass}>{sortButton("selectedTeacherStudents", "lastName", "Mbiemri")}</th>
                        <th className={thClass}>{sortButton("selectedTeacherStudents", "course", "Kursi")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTeacherStudents.length > 0 ? (
                        sortedSelectedTeacherStudents.map((student) => (
                          <tr key={student.id} className={rowHover}>
                            <td className={tdClass}>{rowNumber(selectedTeacherStudents, student)}</td>
                            <td className={tdClass}>{student.firstName || student.name}</td>
                            <td className={tdClass}>{student.lastName || "-"}</td>
                            <td className={tdClass}>{student.course || "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td className={tdClass} colSpan={4}>Ky mësues nuk ka nxënës.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === "payments" && (
          <div className={`border rounded-lg lg:rounded-2xl shadow-sm ${card} p-3 sm:p-4`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: PRIMARY }}>Pagesat</h2>
                <p className="text-gray-500">Menaxho pagesat dhe filtro sipas studentit, mësuesit ose datës.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full lg:w-[34rem]">
                {searchField({
                  value: paymentSearch,
                  onChange: (e) => setPaymentSearch(e.target.value),
                  placeholder: "Kërko pagesa",
                })}
                <select className={input} value={activePaymentTeacherFilter} onChange={(e) => setPaymentTeacherFilter(e.target.value)}>
                  <option value="">Të gjithë mësuesit</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.name}>{teacher.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end mb-6">
              <button onClick={openPaymentModal} className={mainBtn} style={secondaryBtnStyle}>{actionLabel("add", "Shto pagesë")}</button>
            </div>

            <div className={tableWrap}>
              <table className="min-w-[52rem] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={thClass}>{sortButton("payments", "nr", "Nr")}</th>
                    <th className={thClass}>{sortButton("payments", "studentName", "Nxënësi")}</th>
                    <th className={thClass}>{sortButton("payments", "teacherName", "Mësuesi")}</th>
                    <th className={thClass}>{sortButton("payments", "amount", "Shuma")}</th>
                    <th className={thClass}>{sortButton("payments", "date", "Data")}</th>
                    <th className={thClass}>{sortButton("payments", "note", "Shenime")}</th>
                    <th className={thClass}>Veprime</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPayments.map((payment) => {
                    const isEditing = editingPaymentId === payment.id;
                    return (
                      <tr key={payment.id} className={rowHover}>
                        <td className={tdClass}>{rowNumber(filteredPayments, payment)}</td>
                        <td className={tdClass}>{isEditing ? (
                          <select className={input} value={editingPaymentStudentId} onChange={(e) => setEditingPaymentStudentId(e.target.value)}>
                            <option value="">Zgjedh nxënësin</option>
                            {students.map((student) => (
                              <option key={student.id} value={student.id}>{student.name}</option>
                            ))}
                          </select>
                        ) : payment.studentName}</td>
                        <td className={tdClass}>{payment.teacherName}</td>
                        <td className={tdClass}>{isEditing ? (
                          <input className={input} value={editingPaymentAmount} onChange={(e) => setEditingPaymentAmount(e.target.value)} type="number" min="0" step="0.01" />
                        ) : formatCurrency(payment.amount)}</td>
                        <td className={tdClass}>{isEditing ? (
                          <input className={dateInput} value={editingPaymentDate} onChange={(e) => setEditingPaymentDate(e.target.value)} type="date" />
                        ) : formatDateDisplay(payment.date)}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingPaymentNote} onChange={(e) => setEditingPaymentNote(e.target.value)} /> : (payment.note || "-")}</td>
                        <td className={tdClass}>
                          <div className="flex flex-wrap gap-2">
                            {isEditing ? (
                              <>
                                <button onClick={saveEditPayment} className={smallBtn} style={primaryBtnStyle}>Save</button>
                                <button onClick={() => { setEditingPaymentId(null); setEditingPaymentDate(""); setEditingPaymentNote(""); }} className={smallBtn} style={secondaryBtnStyle}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEditPayment(payment)} className={smallBtn} style={secondaryBtnStyle}>{actionLabel("edit", "Edit")}</button>
                                <button onClick={() => archivePayment(payment)} className={smallBtn} style={warningBtnStyle}>{actionLabel("archive", "Archive")}</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeView === "paga" && (
          <div className={`border rounded-lg lg:rounded-2xl shadow-sm ${card} p-3 sm:p-4`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: PRIMARY }}>Paga</h2>
                <p className="text-gray-500">Paga e mësuesve sipas përqindjes, me export Excel/PDF.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 w-full xl:w-auto">
                <input className={dateInput} type="month" value={financeMonth} onChange={(e) => setFinanceMonth(e.target.value)} />
                <select className={input} value={activeFinanceTeacherFilter} onChange={(e) => setFinanceTeacherFilter(e.target.value)}>
                  <option value="">Të gjithë mësuesit</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.name}>{teacher.name}</option>
                  ))}
                </select>
                <button onClick={() => openFinanceExportNoteModal("excel")} className={mainBtn} style={secondaryBtnStyle}>{actionLabel("export", "Excel")}</button>
                <button onClick={() => openFinanceExportNoteModal("pdf")} className={mainBtn} style={primaryBtnStyle}>{actionLabel("export", "PDF")}</button>
              </div>
            </div>

            <div className={tableWrap}>
              <table className="min-w-[40rem] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={thClass}>{sortButton("paga", "nr", "Nr")}</th>
                    <th className={thClass}>{sortButton("paga", "name", "Mësuesi")}</th>
                    <th className={thClass}>%</th>
                    <th className={thClass}>{sortButton("paga", "studentsCount", "Nxënës")}</th>
                    <th className={thClass}>{sortButton("paga", "total", "Total")}</th>
                    <th className={thClass}>{sortButton("paga", "teacherShare", "Mësuesi")}</th>
                    <th className={thClass}>{sortButton("paga", "adminShare", "Administrata")}</th>
                    <th className={thClass}>{sortButton("paga", "schoolShare", "Shkolla")}</th>
                    <th className={thClass}>{sortButton("paga", "remainingShare", "Mbetja")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTeacherEarnings.map((teacher) => (
                    <tr key={teacher.id} className={rowHover}>
                      <td className={tdClass}>{rowNumber(teacherEarnings, teacher)}</td>
                      <td className={tdClass}>{teacher.name}</td>
                      <td className={tdClass}>{teacher.percent}%</td>
                      <td className={tdClass}>{teacher.studentsCount}</td>
                      <td className={tdClass}>{formatCurrency(teacher.total)}</td>
                      <td className={tdClass}>{formatCurrency(teacher.teacherShare)}</td>
                      <td className={tdClass}>{formatCurrency(teacher.adminShare)}</td>
                      <td className={tdClass}>{formatCurrency(teacher.schoolShare)}</td>
                      <td className={tdClass}>{formatCurrency(teacher.remainingShare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeView === "finance" && (
          <div className={`border rounded-lg lg:rounded-2xl shadow-sm ${card} p-3 sm:p-4 space-y-4 lg:space-y-6`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: PRIMARY }}>Financa</h2>
                <p className="text-gray-500">Overview + shpenzimet e shkollës.</p>
              </div>
              <div className="w-full lg:w-60">
                <input className={dateInput} type="month" value={financeOverviewMonth} onChange={(e) => setFinanceOverviewMonth(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border">
                <div className="text-gray-500 text-sm">Të hyrat</div>
                <div className="text-xl font-bold">{formatCurrency(overviewIncome)}</div>
              </div>
              <div className="p-4 rounded-xl border">
                <div className="text-gray-500 text-sm">Paga mësuesve</div>
                <div className="text-xl font-bold">{formatCurrency(overviewTeacherPay)}</div>
              </div>
              <div className="p-4 rounded-xl border">
                <div className="text-gray-500 text-sm">Shpenzime</div>
                <div className="text-xl font-bold">{formatCurrency(overviewExpenses)}</div>
              </div>
              <div className="p-4 rounded-xl border">
                <div className="text-gray-500 text-sm">Fitimi</div>
                <div className="text-xl font-bold">
                  {formatCurrency(
                    overviewProfit
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button className={mainBtn} style={secondaryBtnStyle} onClick={openExpenseModal}>{actionLabel("add", "Shto shpenzim")}</button>
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-[26rem]">
                <input className={dateInput} type="month" value={expenseMonthFilter} onChange={(e) => setExpenseMonthFilter(e.target.value)} />
                <button onClick={() => setExpenseMonthFilter("")} className={mainBtn} style={secondaryBtnStyle}>{actionLabel("clear", "Pastro filtrin")}</button>
              </div>
              <div className="flex gap-2">
                <button onClick={exportExpensesExcel} className={mainBtn} style={secondaryBtnStyle}>{actionLabel("export", "Excel shpenzimet")}</button>
                <button onClick={exportExpensesPdf} className={mainBtn} style={primaryBtnStyle}>{actionLabel("export", "PDF shpenzimet")}</button>
              </div>
            </div>

            <div className={tableWrap}>
              <table className="min-w-[42rem] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={thClass}>{sortButton("finance", "nr", "Nr")}</th>
                    <th className={thClass}>{sortButton("finance", "name", "Produkti")}</th>
                    <th className={thClass}>{sortButton("finance", "date", "Data")}</th>
                    <th className={thClass}>{sortButton("finance", "amount", "Çmimi")}</th>
                    <th className={thClass}>Shenime</th>
                    <th className={thClass}>Veprime</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedExpenses.map((expense) => {
                    const isEditing = editingExpenseId === expense.id;
                    return (
                      <tr key={expense.id} className={rowHover}>
                        <td className={tdClass}>{rowNumber(filteredExpenses, expense)}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingExpenseName} onChange={(e) => setEditingExpenseName(e.target.value)} /> : expense.name}</td>
                        <td className={tdClass}>{isEditing ? <input className={dateInput} type="date" value={editingExpenseDate} onChange={(e) => setEditingExpenseDate(e.target.value)} /> : formatDateDisplay(expense.date)}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} type="number" value={editingExpenseAmount} onChange={(e) => setEditingExpenseAmount(e.target.value)} /> : formatCurrency(expense.amount)}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={expenseNote} onChange={(e) => setExpenseNote(e.target.value)} /> : (expense.note || "-")}</td>
                        <td className={tdClass}>
                          <div className="flex gap-2">
                            {isEditing ? (
                              <>
                                <button onClick={saveEditExpense} className={smallBtn} style={primaryBtnStyle}>Save</button>
                                <button onClick={() => { setEditingExpenseId(null); setExpenseNote(""); }} className={smallBtn} style={secondaryBtnStyle}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEditExpense(expense)} className={smallBtn} style={secondaryBtnStyle}>{actionLabel("edit", "Edit")}</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeView === "courses" && (
          <div className={`border rounded-lg lg:rounded-2xl shadow-sm ${card} p-3 sm:p-4`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: PRIMARY }}>Kurset</h2>
                <p className="text-gray-500">Menaxho kurset dhe çmimet.</p>
              </div>
              <div className="w-full lg:w-80">
                {searchField({
                  value: courseSearch,
                  onChange: (e) => setCourseSearch(e.target.value),
                  placeholder: "Kërko sipas kursit ose çmimit",
                })}
              </div>
            </div>

            <div className="flex justify-end mb-6">
              <button onClick={() => setIsCourseModalOpen(true)} className={mainBtn} style={primaryBtnStyle}>{actionLabel("add", "Shto kurs")}</button>
            </div>

            <div className={tableWrap}>
              <table className="min-w-[36rem] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={thClass}>{sortButton("courses", "nr", "Nr")}</th>
                    <th className={thClass}>{sortButton("courses", "name", "Emri i kursit")}</th>
                    <th className={thClass}>{sortButton("courses", "price", "Çmimi")}</th>
                    <th className={thClass}>Veprime</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCourses.map((course) => {
                    const isEditing = editingCourseId === course.id;
                    return (
                      <tr key={course.id} className={rowHover}>
                        <td className={tdClass}>{rowNumber(filteredCourses, course)}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingCourseName} onChange={(e) => setEditingCourseName(e.target.value)} /> : course.name}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingCoursePrice} onChange={(e) => setEditingCoursePrice(e.target.value)} type="number" min="0" step="0.01" /> : formatCurrency(course.price)}</td>
                        <td className={tdClass}>
                          <div className="flex flex-wrap gap-2">
                            {isEditing ? (
                              <>
                                <button onClick={saveEditCourse} className={smallBtn} style={primaryBtnStyle}>Save</button>
                                <button onClick={() => setEditingCourseId(null)} className={smallBtn} style={secondaryBtnStyle}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEditCourse(course)} className={smallBtn} style={secondaryBtnStyle}>{actionLabel("edit", "Edit")}</button>
                                <button onClick={() => archiveCourse(course)} className={smallBtn} style={warningBtnStyle}>{actionLabel("archive", "Archive")}</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeView === "archive" && (
          <div className={`border rounded-lg lg:rounded-2xl shadow-sm ${card} p-3 sm:p-4 space-y-4 lg:space-y-6`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: PRIMARY }}>Archive</h2>
                <p className="text-gray-500">Këtu ruhen të dhënat e arkivuara dhe mund t’i kthesh prapë aktive.</p>
              </div>
              <div className="w-full lg:w-80">
                {searchField({
                  value: archiveSearch,
                  onChange: (e) => setArchiveSearch(e.target.value),
                  placeholder: "Kërko në archive",
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold" style={{ color: PRIMARY }}>Nxënës</h3>
                <div className="flex gap-2">
                  <button onClick={() => bulkRestore("students")} disabled={!archiveSelection.students.length} className={smallBtn} style={archiveSelection.students.length ? primaryBtnStyle : disabledPrimaryBtnStyle}>{actionLabel("restore", "Restore Selected")}</button>
                  <button onClick={() => bulkDeleteArchived("students")} disabled={!archiveSelection.students.length} className={smallBtn} style={archiveSelection.students.length ? dangerBtnStyle : { background: "#d1d5db", color: "#6b7280", cursor: "not-allowed" }}>{actionLabel("delete", "Delete Selected")}</button>
                </div>
              </div>
              <div className={tableWrap}>
                <table className="min-w-[40rem] w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className={thClass}>{sortButton("archive", "nr", "Nr")}</th>
                      <th className={thClass}>#</th>
                      <th className={thClass}>{sortButton("archive", "name", "Emri")}</th>
                      <th className={thClass}>{sortButton("archive", "teacherName", "Mësuesi")}</th>
                      <th className={thClass}>Veprimi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedArchiveStudents.map((student) => {
                      const teacher = teachers.find((t) => Number(t.id) === Number(student.teacherId));
                      return (
                        <tr key={student.id} className={rowHover}>
                          <td className={tdClass}>{rowNumber(filteredArchiveStudents, student)}</td>
                          <td className={tdClass}><input type="checkbox" className={roundCheckbox} checked={archiveSelection.students.includes(student.id)} onChange={() => toggleArchiveSelection("students", student.id)} /></td>
                          <td className={tdClass}>{student.name}</td>
                          <td className={tdClass}>{teacher?.name || "-"}</td>
                          <td className={tdClass}>
                            <div className="flex gap-2">
                              <button onClick={() => restoreStudent(student)} className={smallBtn} style={primaryBtnStyle}>{actionLabel("restore", "Restore")}</button>
                              <button onClick={() => deleteArchivedItem("students", student.id)} className={smallBtn} style={dangerBtnStyle}>{actionLabel("delete", "Delete")}</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold" style={{ color: PRIMARY }}>Mësues</h3>
                <div className="flex gap-2">
                  <button onClick={() => bulkRestore("teachers")} disabled={!archiveSelection.teachers.length} className={smallBtn} style={archiveSelection.teachers.length ? primaryBtnStyle : disabledPrimaryBtnStyle}>{actionLabel("restore", "Restore Selected")}</button>
                  <button onClick={() => bulkDeleteArchived("teachers")} disabled={!archiveSelection.teachers.length} className={smallBtn} style={archiveSelection.teachers.length ? dangerBtnStyle : { background: "#d1d5db", color: "#6b7280", cursor: "not-allowed" }}>{actionLabel("delete", "Delete Selected")}</button>
                </div>
              </div>
              <div className={tableWrap}>
                <table className="min-w-[34rem] w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className={thClass}>{sortButton("archive", "nr", "Nr")}</th>
                      <th className={thClass}>#</th>
                      <th className={thClass}>Emri</th>
                      <th className={thClass}>%</th>
                      <th className={thClass}>Veprimi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedArchiveTeachers.map((teacher) => (
                      <tr key={teacher.id} className={rowHover}>
                        <td className={tdClass}>{rowNumber(filteredArchiveTeachers, teacher)}</td>
                        <td className={tdClass}><input type="checkbox" className={roundCheckbox} checked={archiveSelection.teachers.includes(teacher.id)} onChange={() => toggleArchiveSelection("teachers", teacher.id)} /></td>
                        <td className={tdClass}>{teacher.name}</td>
                        <td className={tdClass}>{teacher.percent}%</td>
                        <td className={tdClass}>
                          <div className="flex gap-2">
                            <button onClick={() => restoreTeacher(teacher)} className={smallBtn} style={primaryBtnStyle}>{actionLabel("restore", "Restore")}</button>
                            <button onClick={() => deleteArchivedItem("teachers", teacher.id)} className={smallBtn} style={dangerBtnStyle}>{actionLabel("delete", "Delete")}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold" style={{ color: PRIMARY }}>Pagesa</h3>
                <div className="flex gap-2">
                  <button onClick={() => bulkRestore("payments")} disabled={!archiveSelection.payments.length} className={smallBtn} style={archiveSelection.payments.length ? primaryBtnStyle : disabledPrimaryBtnStyle}>{actionLabel("restore", "Restore Selected")}</button>
                  <button onClick={() => bulkDeleteArchived("payments")} disabled={!archiveSelection.payments.length} className={smallBtn} style={archiveSelection.payments.length ? dangerBtnStyle : { background: "#d1d5db", color: "#6b7280", cursor: "not-allowed" }}>{actionLabel("delete", "Delete Selected")}</button>
                </div>
              </div>
              <div className={tableWrap}>
                <table className="min-w-[44rem] w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className={thClass}>{sortButton("archive", "nr", "Nr")}</th>
                      <th className={thClass}>#</th>
                      <th className={thClass}>Nxënësi</th>
                      <th className={thClass}>Mësuesi</th>
                      <th className={thClass}>Shuma</th>
                      <th className={thClass}>Data</th>
                      <th className={thClass}>Veprimi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedArchivePayments.map((payment) => (
                      <tr key={payment.id} className={rowHover}>
                        <td className={tdClass}>{rowNumber(filteredArchivePayments, payment)}</td>
                        <td className={tdClass}><input type="checkbox" className={roundCheckbox} checked={archiveSelection.payments.includes(payment.id)} onChange={() => toggleArchiveSelection("payments", payment.id)} /></td>
                        <td className={tdClass}>{payment.studentName || "Pa student"}</td>
                        <td className={tdClass}>{payment.teacherName || "Pa mësues"}</td>
                        <td className={tdClass}>{formatCurrency(payment.amount)}</td>
                        <td className={tdClass}>{formatDateDisplay(payment.date)}</td>
                        <td className={tdClass}>
                          <div className="flex gap-2">
                            <button onClick={() => restorePayment(payment)} className={smallBtn} style={primaryBtnStyle}>{actionLabel("restore", "Restore")}</button>
                            <button onClick={() => deleteArchivedItem("payments", payment.id)} className={smallBtn} style={dangerBtnStyle}>{actionLabel("delete", "Delete")}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold" style={{ color: PRIMARY }}>Kurset</h3>
                <div className="flex gap-2">
                  <button onClick={() => bulkRestore("courses")} disabled={!(archiveSelection.courses || []).length} className={smallBtn} style={(archiveSelection.courses || []).length ? primaryBtnStyle : disabledPrimaryBtnStyle}>{actionLabel("restore", "Restore Selected")}</button>
                  <button onClick={() => bulkDeleteArchived("courses")} disabled={!(archiveSelection.courses || []).length} className={smallBtn} style={(archiveSelection.courses || []).length ? dangerBtnStyle : { background: "#d1d5db", color: "#6b7280", cursor: "not-allowed" }}>{actionLabel("delete", "Delete Selected")}</button>
                </div>
              </div>
              <div className={tableWrap}>
                <table className="min-w-[34rem] w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className={thClass}>{sortButton("courses", "nr", "Nr")}</th>
                      <th className={thClass}>#</th>
                      <th className={thClass}>{sortButton("courses", "name", "Emri i kursit")}</th>
                      <th className={thClass}>{sortButton("courses", "price", "Çmimi")}</th>
                      <th className={thClass}>Veprimi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedArchiveCourses.map((course) => (
                      <tr key={course.id} className={rowHover}>
                        <td className={tdClass}>{rowNumber(filteredArchiveCourses, course)}</td>
                        <td className={tdClass}><input type="checkbox" className={roundCheckbox} checked={(archiveSelection.courses || []).includes(course.id)} onChange={() => toggleArchiveSelection("courses", course.id)} /></td>
                        <td className={tdClass}>{course.name}</td>
                        <td className={tdClass}>{formatCurrency(course.price)}</td>
                        <td className={tdClass}>
                          <div className="flex gap-2">
                            <button onClick={() => restoreCourse(course)} className={smallBtn} style={primaryBtnStyle}>{actionLabel("restore", "Restore")}</button>
                            <button onClick={() => deleteArchivedItem("courses", course.id)} className={smallBtn} style={dangerBtnStyle}>{actionLabel("delete", "Delete")}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4" onClick={() => setIsPaymentModalOpen(false)}>
            <form
              className="my-4 w-full max-w-2xl rounded-lg bg-white p-4 sm:p-6 shadow-xl space-y-4"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                addPayment();
              }}
            >
              <div>
                <h3 className="text-xl font-bold" style={{ color: PRIMARY }}>Shto pagesë</h3>
                <p className="text-sm text-gray-500">Zgjedh nxënësin dhe përcakto ndarjen e pagesës.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select className={input} value={selectedStudent} onChange={(e) => changePaymentStudent(e.target.value)} required>
                  <option value="">Zgjedh nxënësin</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{student.name}</option>
                  ))}
                </select>
                <input className={input} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Shuma" />
                <input className={dateInput} type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                <div className="relative min-w-0">
                  <input className={`${input} pr-9`} type="number" min="0" max="100" step="0.01" value={paymentTeacherPercent} onChange={(e) => setPaymentTeacherPercent(e.target.value)} placeholder="Paga e mësuesit" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                </div>
                <div className="relative min-w-0">
                  <input className={`${input} pr-9`} type="number" min="0" max="100" step="0.01" value={paymentAdminPercent} onChange={(e) => setPaymentAdminPercent(e.target.value)} placeholder="Administrata" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                </div>
                <div className="relative min-w-0">
                  <input className={`${input} pr-9`} type="number" min="0" max="100" step="0.01" value={paymentSchoolPercent} onChange={(e) => setPaymentSchoolPercent(e.target.value)} placeholder="Shkolla" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                </div>
                <input className={`${input} md:col-span-2`} value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Shenime" />
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className={smallBtn} style={secondaryBtnStyle}>Cancel</button>
                <button type="submit" className={smallBtn} style={primaryBtnStyle}>Save</button>
              </div>
            </form>
          </div>
        )}

        {isExpenseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4" onClick={() => setIsExpenseModalOpen(false)}>
            <form
              className="my-4 w-full max-w-xl rounded-lg bg-white p-4 sm:p-6 shadow-xl space-y-4"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                addExpense();
              }}
            >
              <div>
                <h3 className="text-xl font-bold" style={{ color: PRIMARY }}>Shto shpenzim</h3>
                <p className="text-sm text-gray-500">Plotëso produktin, datën dhe çmimin.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className={input} value={expenseName} onChange={(e) => setExpenseName(e.target.value)} placeholder="Produkti / Shpenzimi" required />
                <input className={dateInput} type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
                <input className={`${input} md:col-span-2`} type="number" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="Çmimi" min="0" step="0.01" required />
                <input className={`${input} md:col-span-2`} value={expenseNote} onChange={(e) => setExpenseNote(e.target.value)} placeholder="Shenime" />
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className={smallBtn} style={secondaryBtnStyle}>Cancel</button>
                <button type="submit" className={smallBtn} style={primaryBtnStyle}>Save</button>
              </div>
            </form>
          </div>
        )}

        {isFinanceExportNoteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4" onClick={() => setIsFinanceExportNoteModalOpen(false)}>
            <form
              className="my-4 w-full max-w-xl rounded-lg bg-white p-4 sm:p-6 shadow-xl space-y-4"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                submitFinanceExportNote();
              }}
            >
              <div>
                <h3 className="text-xl font-bold" style={{ color: PRIMARY }}>Shënime për eksport</h3>
                <p className="text-sm text-gray-500">Ky tekst vendoset te kolona Shenime.</p>
              </div>

              <textarea className={`${input} min-h-28`} value={financeExportNote} onChange={(e) => setFinanceExportNote(e.target.value)} placeholder="Shenime" />

              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <button type="button" onClick={() => setIsFinanceExportNoteModalOpen(false)} className={smallBtn} style={secondaryBtnStyle}>Cancel</button>
                <button type="submit" className={smallBtn} style={primaryBtnStyle}>{actionLabel("export", "Export")}</button>
              </div>
            </form>
          </div>
        )}

        {isStudentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4" onClick={() => { setIsStudentModalOpen(false); setStudentForm(emptyStudentForm); }}>
            <form
              className="my-4 w-full max-w-2xl rounded-lg bg-white p-4 sm:p-6 shadow-xl space-y-4"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                addStudent();
              }}
            >
              <div>
                <h3 className="text-xl font-bold" style={{ color: PRIMARY }}>Shto nx&euml;n&euml;s</h3>
                <p className="text-sm text-gray-500">Plot&euml;so t&euml; dh&euml;nat e nx&euml;n&euml;sit.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className={input} value={studentForm.firstName} onChange={(e) => setStudentForm((prev) => ({ ...prev, firstName: e.target.value }))} placeholder="Emri" required />
                <input className={input} value={studentForm.lastName} onChange={(e) => setStudentForm((prev) => ({ ...prev, lastName: e.target.value }))} placeholder="Mbiemri" required />
                <input className={input} value={studentForm.age} onChange={(e) => setStudentForm((prev) => ({ ...prev, age: e.target.value }))} placeholder="Mosha" type="number" min="0" />
                <input className={input} value={studentForm.city} onChange={(e) => setStudentForm((prev) => ({ ...prev, city: e.target.value }))} placeholder="Qyteti" />
                <input className={input} value={studentForm.phone} onChange={(e) => setStudentForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Numri i telefonit" />
                <input className={input} value={studentForm.email} onChange={(e) => setStudentForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Emaili" type="email" />
                <select className={`${input} md:col-span-2`} value={studentForm.course} onChange={(e) => setStudentForm((prev) => ({ ...prev, course: e.target.value }))} required>
                  <option value="">Zgjedh kursin</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.name}>{course.name}</option>
                  ))}
                </select>
                <input className={`${dateInput} md:col-span-2`} type="month" value={studentForm.group} onChange={(e) => setStudentForm((prev) => ({ ...prev, group: e.target.value }))} />
                <select className={`${input} md:col-span-2`} value={studentForm.teacherId} onChange={(e) => setStudentForm((prev) => ({ ...prev, teacherId: e.target.value }))}>
                  <option value="">Pa mesues</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <button type="button" onClick={() => { setIsStudentModalOpen(false); setStudentForm(emptyStudentForm); }} className={smallBtn} style={secondaryBtnStyle}>Cancel</button>
                <button type="submit" className={smallBtn} style={primaryBtnStyle}>Save</button>
              </div>
            </form>
          </div>
        )}

        {isTeacherModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4" onClick={() => { setIsTeacherModalOpen(false); setTeacherForm(emptyTeacherForm); }}>
            <form
              className="my-4 w-full max-w-xl rounded-lg bg-white p-4 sm:p-6 shadow-xl space-y-4"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                addTeacher();
              }}
            >
              <div>
                <h3 className="text-xl font-bold" style={{ color: PRIMARY }}>Shto m&euml;sues</h3>
                <p className="text-sm text-gray-500">Plot&euml;so t&euml; dh&euml;nat e m&euml;suesit.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className={input} value={teacherForm.firstName} onChange={(e) => setTeacherForm((prev) => ({ ...prev, firstName: e.target.value }))} placeholder="Emri" required />
                <input className={input} value={teacherForm.lastName} onChange={(e) => setTeacherForm((prev) => ({ ...prev, lastName: e.target.value }))} placeholder="Mbiemri" required />
                <select className={`${input} md:col-span-2`} value={teacherForm.percent} onChange={(e) => setTeacherForm((prev) => ({ ...prev, percent: e.target.value }))}>
                  {percentOptions.map((percent) => (
                    <option key={percent} value={percent}>{percent}%</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <button type="button" onClick={() => { setIsTeacherModalOpen(false); setTeacherForm(emptyTeacherForm); }} className={smallBtn} style={secondaryBtnStyle}>Cancel</button>
                <button type="submit" className={smallBtn} style={primaryBtnStyle}>Save</button>
              </div>
            </form>
          </div>
        )}

        {isCourseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4" onClick={() => { setIsCourseModalOpen(false); setCourseForm(emptyCourseForm); }}>
            <form
              className="my-4 w-full max-w-xl rounded-lg bg-white p-4 sm:p-6 shadow-xl space-y-4"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                addCourse();
              }}
            >
              <div>
                <h3 className="text-xl font-bold" style={{ color: PRIMARY }}>Shto kurs</h3>
                <p className="text-sm text-gray-500">Plotëso emrin dhe çmimin e kursit.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className={input} value={courseForm.name} onChange={(e) => setCourseForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Emri i kursit" required />
                <input className={input} value={courseForm.price} onChange={(e) => setCourseForm((prev) => ({ ...prev, price: e.target.value }))} placeholder="Çmimi" type="number" min="0" step="0.01" required />
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <button type="button" onClick={() => { setIsCourseModalOpen(false); setCourseForm(emptyCourseForm); }} className={smallBtn} style={secondaryBtnStyle}>Cancel</button>
                <button type="submit" className={smallBtn} style={primaryBtnStyle}>Save</button>
              </div>
            </form>
          </div>
        )}

        {isAssignStudentsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4" onClick={() => setIsAssignStudentsModalOpen(false)}>
            <div className="my-4 w-full max-w-2xl rounded-lg bg-white p-4 sm:p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
              <div>
                <h3 className="text-xl font-bold" style={{ color: PRIMARY }}>Cakto nx&euml;n&euml;sit</h3>
                <p className="text-sm text-gray-500">Choose a teacher, then select the students for that teacher.</p>
              </div>

              <select className={input} value={assignTeacherId} onChange={(e) => changeAssignTeacher(e.target.value)}>
                <option value="">Choose teacher</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                ))}
              </select>

              <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-gray-200">
                {students.some((student) => !student.teacherId || Number(student.teacherId) === Number(assignTeacherId)) ? (
                  students
                    .filter((student) => !student.teacherId || Number(student.teacherId) === Number(assignTeacherId))
                    .map((student) => {
                    const currentTeacher = teachers.find((teacher) => Number(teacher.id) === Number(student.teacherId));
                    const isChecked = assignStudentIds.includes(Number(student.id));
                    return (
                      <label key={student.id} className="flex items-start gap-3 border-b border-gray-100 px-3 py-3 last:border-b-0">
                        <input
                          type="checkbox"
                          className={`${roundCheckbox} mt-1`}
                          checked={isChecked}
                          onChange={() => toggleAssignStudent(Number(student.id))}
                          disabled={!assignTeacherId}
                        />
                        <span className="flex-1">
                          <span className="block font-medium">{student.name}</span>
                          <span className="block text-sm text-gray-500">{currentTeacher?.name || "Pa mesues"}</span>
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <div className="px-3 py-4 text-sm text-gray-500">No unassigned students available.</div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <button type="button" onClick={() => setIsAssignStudentsModalOpen(false)} className={smallBtn} style={secondaryBtnStyle}>Cancel</button>
                <button type="button" onClick={saveAssignedStudents} disabled={!assignTeacherId} className={smallBtn} style={assignTeacherId ? primaryBtnStyle : disabledPrimaryBtnStyle}>Save</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
