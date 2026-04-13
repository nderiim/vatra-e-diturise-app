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
import informationIcon from "./assets/information.png";
import logoVd from "./assets/logo_vd.svg";
import restoreIcon from "./assets/restore.png";
import searchIcon from "./assets/search.png";
import settingsIcon from "./assets/settings.png";
import sidebarIcon from "./assets/sidebar.png";
import { isSupabaseConfigured, supabase } from "./supabase";

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

function sameId(a, b) {
  return String(a ?? "") === String(b ?? "");
}

export default function App() {
  const PRIMARY = "#2e2c80";
  const SECONDARY = "#54807f";
  const HIGHLIGHT = "#80a68a";
  const WARNING = "#d4a017";
  const DANGER = "#c0392b";

  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [archive, setArchive] = useState({
    students: [],
    teachers: [],
    payments: [],
    courses: [],
  });
  const [expenses, setExpenses] = useState([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");

  const [activeView, setActiveView] = useState("students");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedTeacherView, setSelectedTeacherView] = useState(null);
  const [selectedStudentView, setSelectedStudentView] = useState(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAllIncomeModalOpen, setIsAllIncomeModalOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
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
  const currentUser = session?.user;
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
    information: informationIcon,
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

  const normalizeStudent = (row) => ({
    id: row.id,
    name: row.name || [row.first_name, row.last_name].filter(Boolean).join(" "),
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    age: row.age == null ? "" : String(row.age),
    city: row.city || "",
    phone: row.phone || "",
    email: row.email || "",
    course: row.course || "",
    group: row.group || "",
    teacherId: row.teacher_id,
    archivedAt: row.archived_at,
  });

  const normalizeTeacher = (row) => ({
    id: row.id,
    name: row.name || [row.first_name, row.last_name].filter(Boolean).join(" "),
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    percent: Number(row.percent ?? 80),
    archivedAt: row.archived_at,
  });

  const normalizeCourse = (row) => ({
    id: row.id,
    name: row.name || "",
    price: Number(row.price || 0),
    archivedAt: row.archived_at,
  });

  const normalizePayment = (row) => ({
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name || "",
    teacherId: row.teacher_id,
    teacherName: row.teacher_name || "",
    amount: Number(row.amount || 0),
    teacherPercent: Number(row.teacher_percent ?? 80),
    adminPercent: Number(row.admin_percent ?? 15),
    schoolPercent: Number(row.school_percent ?? 5),
    note: row.note || "",
    date: row.date,
    archivedAt: row.archived_at,
  });

  const normalizeExpense = (row) => ({
    id: row.id,
    name: row.name || "",
    date: row.date,
    amount: Number(row.amount || 0),
    note: row.note || "",
    archivedAt: row.archived_at,
  });

  const studentToRow = (student) => ({
    name: student.name,
    first_name: student.firstName,
    last_name: student.lastName,
    age: student.age || null,
    city: student.city,
    phone: student.phone,
    email: student.email,
    course: student.course,
    group: student.group || null,
    teacher_id: student.teacherId ?? null,
  });

  const teacherToRow = (teacher) => ({
    name: teacher.name,
    first_name: teacher.firstName,
    last_name: teacher.lastName,
    percent: Number(teacher.percent),
  });

  const courseToRow = (course) => ({
    name: course.name,
    price: Number(course.price || 0),
  });

  const paymentToRow = (payment) => ({
    student_id: payment.studentId ?? null,
    student_name: payment.studentName,
    teacher_id: payment.teacherId ?? null,
    teacher_name: payment.teacherName,
    amount: Number(payment.amount || 0),
    teacher_percent: Number(payment.teacherPercent ?? 80),
    admin_percent: Number(payment.adminPercent ?? 15),
    school_percent: Number(payment.schoolPercent ?? 5),
    note: payment.note || "",
    date: payment.date,
  });

  const expenseToRow = (expense) => ({
    name: expense.name,
    date: expense.date,
    amount: Number(expense.amount || 0),
    note: expense.note || "",
  });

  const splitArchived = (rows, normalize) => {
    const normalizedRows = rows.map(normalize);
    return {
      active: normalizedRows.filter((row) => !row.archivedAt),
      archived: normalizedRows.filter((row) => row.archivedAt),
    };
  };

  const rowsAreEqual = (firstRow, secondRow) => JSON.stringify(firstRow) === JSON.stringify(secondRow);

  const upsertById = (rows, nextRow) => {
    const existingRow = rows.find((row) => sameId(row.id, nextRow.id));
    if (!existingRow) return [...rows, nextRow];
    if (rowsAreEqual(existingRow, nextRow)) return rows;
    return rows.map((row) => (sameId(row.id, nextRow.id) ? nextRow : row));
  };

  const removeById = (rows, id) => {
    if (!rows.some((row) => sameId(row.id, id))) return rows;
    return rows.filter((row) => !sameId(row.id, id));
  };

  const loadSupabaseData = async ({ showLoading = true } = {}) => {
    if (!supabase) return;

    if (showLoading) setIsDataLoading(true);
    setDataError("");

    const [studentsResult, teachersResult, coursesResult, paymentsResult, expensesResult] = await Promise.all([
      supabase.from("students").select("*"),
      supabase.from("teachers").select("*"),
      supabase.from("courses").select("*"),
      supabase.from("payments").select("*"),
      supabase.from("expenses").select("*"),
    ]);

    const firstError = [studentsResult, teachersResult, coursesResult, paymentsResult, expensesResult].find((result) => result.error)?.error;
    if (firstError) {
      setDataError(firstError.message);
      if (showLoading) setIsDataLoading(false);
      return;
    }

    const nextStudents = splitArchived(studentsResult.data || [], normalizeStudent);
    const nextTeachers = splitArchived(teachersResult.data || [], normalizeTeacher);
    const nextCourses = splitArchived(coursesResult.data || [], normalizeCourse);
    const nextPayments = splitArchived(paymentsResult.data || [], normalizePayment);

    setStudents(nextStudents.active);
    setTeachers(nextTeachers.active);
    setCourses(nextCourses.active);
    setPayments(nextPayments.active);
    setExpenses((expensesResult.data || []).map(normalizeExpense));
    setArchive({
      students: nextStudents.archived,
      teachers: nextTeachers.archived,
      courses: nextCourses.archived,
      payments: nextPayments.archived,
    });
    if (showLoading) setIsDataLoading(false);
  };

  const insertRow = async (table, values, normalize) => {
    const { data, error } = await supabase.from(table).insert(values).select().single();
    if (error) throw error;
    return normalize(data);
  };

  const updateRow = async (table, id, values, normalize) => {
    const { data, error, count } = await supabase.from(table).update(values, { count: "exact" }).eq("id", id).select().maybeSingle();
    if (error) throw error;
    if (count === 0) {
      throw new Error(`No ${table} row was updated. Check the row id and Supabase RLS update/select policies.`);
    }
    return data ? normalize(data) : null;
  };

  const archiveRow = async (table, id) => {
    const { error } = await supabase.from(table).update({ archived_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  };

  const restoreRow = async (table, id) => {
    const { error } = await supabase.from(table).update({ archived_at: null }).eq("id", id);
    if (error) throw error;
  };

  const deleteRow = async (table, id) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
  };

  const reportDataError = (error) => {
    const message = error?.message || "Supabase action failed.";
    setDataError(message);
    window.alert(message);
  };

  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false);
      return undefined;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) setAuthError(error.message);
      setSession(data.session);
      setIsAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsAuthLoading(false);
      setAuthError("");
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) {
      loadSupabaseData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!session || !supabase) return undefined;

    let reloadTimer = null;
    let isReloading = false;
    const scheduleReload = () => {
      window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => {
        if (isReloading) return;
        isReloading = true;
        Promise.resolve(loadSupabaseData({ showLoading: false })).finally(() => {
          isReloading = false;
        });
      }, 300);
    };
    const reloadIfVisible = () => {
      if (document.visibilityState === "visible") scheduleReload();
    };
    const isIosDevice =
      /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    const isStandaloneApp =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    const needsResumeReload = isIosDevice && isStandaloneApp;
    const syncRealtimeRow = (table, payload) => {
      const row = payload.new || payload.old;
      if (!row?.id) {
        scheduleReload();
        return;
      }

      const eventType = payload.eventType;
      const isDelete = eventType === "DELETE";
      const id = row.id;
      const syncActiveAndArchive = (setActive, archiveKey, normalize) => {
        if (isDelete) {
          setActive((prev) => removeById(prev, id));
          setArchive((prev) => ({ ...prev, [archiveKey]: removeById(prev[archiveKey] || [], id) }));
          return;
        }

        const normalizedRow = normalize(payload.new);
        if (normalizedRow.archivedAt) {
          setActive((prev) => removeById(prev, normalizedRow.id));
          setArchive((prev) => ({
            ...prev,
            [archiveKey]: upsertById(prev[archiveKey] || [], normalizedRow),
          }));
          return;
        }

        setActive((prev) => upsertById(prev, normalizedRow));
        setArchive((prev) => ({ ...prev, [archiveKey]: removeById(prev[archiveKey] || [], normalizedRow.id) }));
      };

      if (table === "students") syncActiveAndArchive(setStudents, "students", normalizeStudent);
      if (table === "teachers") syncActiveAndArchive(setTeachers, "teachers", normalizeTeacher);
      if (table === "courses") syncActiveAndArchive(setCourses, "courses", normalizeCourse);
      if (table === "payments") syncActiveAndArchive(setPayments, "payments", normalizePayment);
      if (table === "expenses") {
        if (isDelete || payload.new?.archived_at) {
          setExpenses((prev) => removeById(prev, id));
          return;
        }
        setExpenses((prev) => upsertById(prev, normalizeExpense(payload.new)));
      }
    };

    const channel = supabase.channel("app-data-realtime");
    ["students", "teachers", "courses", "payments", "expenses"].forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => syncRealtimeRow(table, payload)
      );
    });
    channel.subscribe();
    if (needsResumeReload) {
      window.addEventListener("pageshow", reloadIfVisible);
      window.addEventListener("online", reloadIfVisible);
      document.addEventListener("visibilitychange", reloadIfVisible);
    }

    return () => {
      window.clearTimeout(reloadTimer);
      if (needsResumeReload) {
        window.removeEventListener("pageshow", reloadIfVisible);
        window.removeEventListener("online", reloadIfVisible);
        document.removeEventListener("visibilitychange", reloadIfVisible);
      }
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const signInWithGoogle = async () => {
    setAuthError("");
    if (!supabase) {
      setAuthError("Supabase is not configured yet.");
      return;
    }

    const redirectTo = import.meta.env.VITE_SUPABASE_REDIRECT_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) setAuthError(error.message);
  };

  const signOut = async () => {
    setAuthError("");
    if (!supabase) {
      setAuthError("Supabase is not configured yet.");
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
      return;
    }

    setIsSettingsModalOpen(false);
  };

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
        const student = students.find((s) => sameId(s.id, payment.studentId));
        const fallbackTeacherId = payment.teacherId != null ? payment.teacherId : student?.teacherId != null ? student.teacherId : null;
        const teacher = teachers.find((t) => sameId(t.id, fallbackTeacherId));
        const patched = {
          ...payment,
          studentName: payment.studentName || student?.name || "Pa student",
          teacherId: payment.teacherId != null ? payment.teacherId : student?.teacherId != null ? student.teacherId : null,
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
        const student = students.find((s) => sameId(s.id, payment.studentId));
        const fallbackTeacherId = payment.teacherId != null ? payment.teacherId : student?.teacherId != null ? student.teacherId : null;
        const teacher = teachers.find((t) => sameId(t.id, fallbackTeacherId));
        const patched = {
          ...payment,
          studentName: payment.studentName || student?.name || "Pa student",
          teacherId: payment.teacherId != null ? payment.teacherId : student?.teacherId != null ? student.teacherId : null,
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

  const addStudent = async () => {
    const firstName = studentForm.firstName.trim();
    const lastName = studentForm.lastName.trim();
    if (!firstName || !lastName || !studentForm.course) return;

    const nextStudent = {
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      age: studentForm.age.trim(),
      city: studentForm.city.trim(),
      phone: studentForm.phone.trim(),
      email: studentForm.email.trim(),
      course: studentForm.course,
      group: studentForm.group,
      teacherId: studentForm.teacherId || null,
    };

    try {
      const savedStudent = await insertRow("students", studentToRow(nextStudent), normalizeStudent);
      setStudents((prev) => [...prev, savedStudent]);
      setStudentForm(emptyStudentForm);
      setIsStudentModalOpen(false);
    } catch (error) {
      reportDataError(error);
    }
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
            teacherId: teacher ? teacher.id : null,
          };
        })
        .filter(Boolean);

      if (!importedStudents.length) {
        window.alert("Nuk u gjet asnje nxenes per import.");
        return;
      }

      const { data, error } = await supabase.from("students").insert(importedStudents.map(studentToRow)).select();
      if (error) throw error;
      setStudents((prev) => [...prev, ...(data || []).map(normalizeStudent)]);
      window.alert(`U importuan ${importedStudents.length} nxenes.`);
    } catch (error) {
      reportDataError(error);
    } finally {
      event.target.value = "";
    }
  };

  const addTeacher = async () => {
    const firstName = teacherForm.firstName.trim();
    const lastName = teacherForm.lastName.trim();
    if (!firstName || !lastName) return;
    const nextTeacher = {
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      percent: Number(teacherForm.percent),
    };
    try {
      const savedTeacher = await insertRow("teachers", teacherToRow(nextTeacher), normalizeTeacher);
      setTeachers((prev) => [...prev, savedTeacher]);
      setTeacherForm(emptyTeacherForm);
      setIsTeacherModalOpen(false);
    } catch (error) {
      reportDataError(error);
    }
  };

  const addCourse = async () => {
    if (!courseForm.name.trim() || !courseForm.price) return;
    const nextCourse = {
      name: courseForm.name.trim(),
      price: parseFloat(courseForm.price),
    };
    try {
      const savedCourse = await insertRow("courses", courseToRow(nextCourse), normalizeCourse);
      setCourses((prev) => [...prev, savedCourse]);
      setCourseForm(emptyCourseForm);
      setIsCourseModalOpen(false);
    } catch (error) {
      reportDataError(error);
    }
  };

  const startEditCourse = (course) => {
    setEditingCourseId(course.id);
    setEditingCourseName(course.name);
    setEditingCoursePrice(String(course.price));
  };

  const saveEditCourse = async () => {
    if (!editingCourseName.trim() || !editingCoursePrice) return;
    const nextCourse = {
      name: editingCourseName.trim(),
      price: parseFloat(editingCoursePrice),
    };
    try {
      const savedCourse = await updateRow("courses", editingCourseId, courseToRow(nextCourse), normalizeCourse);
      setCourses((prev) => prev.map((course) => (course.id === editingCourseId ? savedCourse || { ...course, ...nextCourse } : course)));
      setEditingCourseId(null);
      setEditingCourseName("");
      setEditingCoursePrice("");
    } catch (error) {
      reportDataError(error);
    }
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
    const student = students.find((s) => sameId(s.id, studentId));
    const price = student ? getStudentCoursePrice(student) : 0;
    setPaymentAmount(price ? formatExportCurrency(price) : "");
  };

  const addPayment = async () => {
    if (!paymentAmount || !selectedStudent) return;
    const student = students.find((s) => sameId(s.id, selectedStudent));
    const teacher = teachers.find((t) => sameId(t.id, student?.teacherId));
    const nextPayment = 
      {
        studentId: selectedStudent,
        studentName: student?.name || "Pa student",
        teacherId: student?.teacherId ?? null,
        teacherName: teacher?.name || "Pa mësues",
        amount: parseMoney(paymentAmount),
        teacherPercent: Number(paymentTeacherPercent),
        adminPercent: Number(paymentAdminPercent),
        schoolPercent: Number(paymentSchoolPercent),
        note: paymentNote.trim(),
        date: paymentDate ? `${paymentDate}T00:00:00.000Z` : new Date().toISOString(),
      };
    try {
      const savedPayment = await insertRow("payments", paymentToRow(nextPayment), normalizePayment);
      setPayments((prev) => [...prev, savedPayment]);
      setPaymentAmount("");
      setPaymentNote("");
      setSelectedStudent("");
      setPaymentDate(currentDateInput());
      setPaymentTeacherPercent(80);
      setPaymentAdminPercent(15);
      setPaymentSchoolPercent(5);
      setIsPaymentModalOpen(false);
    } catch (error) {
      reportDataError(error);
    }
  };

  const openExpenseModal = () => {
    setExpenseName("");
    setExpenseDate(currentDateInput());
    setExpenseAmount("");
    setExpenseNote("");
    setIsExpenseModalOpen(true);
  };

  const addExpense = async () => {
    if (!expenseName.trim() || !expenseAmount) return;
    const nextExpense = {
      name: expenseName.trim(),
      date: expenseDate || new Date().toISOString(),
      amount: parseFloat(expenseAmount),
      note: expenseNote.trim(),
    };
    try {
      const savedExpense = await insertRow("expenses", expenseToRow(nextExpense), normalizeExpense);
      setExpenses((prev) => [...prev, savedExpense]);
      setExpenseName("");
      setExpenseDate(currentDateInput());
      setExpenseAmount("");
      setExpenseNote("");
      setIsExpenseModalOpen(false);
    } catch (error) {
      reportDataError(error);
    }
  };

  const startEditExpense = (expense) => {
    setEditingExpenseId(expense.id);
    setEditingExpenseName(expense.name);
    setEditingExpenseDate(expense.date ? String(expense.date).slice(0, 10) : "");
    setEditingExpenseAmount(String(expense.amount));
    setExpenseNote(expense.note || "");
  };

  const saveEditExpense = async () => {
    if (!editingExpenseName.trim() || !editingExpenseAmount) return;
    const existingExpense = expenses.find((expense) => expense.id === editingExpenseId);
    const nextExpense = {
      name: editingExpenseName.trim(),
      date: editingExpenseDate || existingExpense?.date,
      amount: parseFloat(editingExpenseAmount),
      note: expenseNote.trim(),
    };
    try {
      const savedExpense = await updateRow("expenses", editingExpenseId, expenseToRow(nextExpense), normalizeExpense);
      setExpenses((prev) => prev.map((expense) => (expense.id === editingExpenseId ? savedExpense || { ...expense, ...nextExpense } : expense)));
      setEditingExpenseId(null);
      setEditingExpenseName("");
      setEditingExpenseDate("");
      setEditingExpenseAmount("");
      setExpenseNote("");
    } catch (error) {
      reportDataError(error);
    }
  };

  const archiveStudent = async (student) => {
    try {
      await archiveRow("students", student.id);
      setArchive((prev) => ({ ...prev, students: [...prev.students, { ...student, archivedAt: new Date().toISOString() }] }));
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
    } catch (error) {
      reportDataError(error);
    }
  };

  const archiveTeacher = async (teacher) => {
    try {
      await archiveRow("teachers", teacher.id);
      setArchive((prev) => ({ ...prev, teachers: [...prev.teachers, { ...teacher, archivedAt: new Date().toISOString() }] }));
      setTeachers((prev) => prev.filter((t) => t.id !== teacher.id));
    } catch (error) {
      reportDataError(error);
    }
  };

  const archivePayment = async (payment) => {
    try {
      await archiveRow("payments", payment.id);
      setArchive((prev) => ({ ...prev, payments: [...prev.payments, { ...payment, archivedAt: new Date().toISOString() }] }));
      setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    } catch (error) {
      reportDataError(error);
    }
  };

  const archiveCourse = async (course) => {
    try {
      await archiveRow("courses", course.id);
      setArchive((prev) => ({ ...prev, courses: [...(prev.courses || []), { ...course, archivedAt: new Date().toISOString() }] }));
      setCourses((prev) => prev.filter((item) => item.id !== course.id));
    } catch (error) {
      reportDataError(error);
    }
  };

  const restoreStudent = async (student) => {
    try {
      await restoreRow("students", student.id);
      setStudents((prev) => [...prev, { ...student, archivedAt: null }]);
      setArchive((prev) => ({ ...prev, students: prev.students.filter((x) => x.id !== student.id) }));
    } catch (error) {
      reportDataError(error);
    }
  };

  const restoreTeacher = async (teacher) => {
    try {
      await restoreRow("teachers", teacher.id);
      setTeachers((prev) => [...prev, { ...teacher, archivedAt: null }]);
      setArchive((prev) => ({ ...prev, teachers: prev.teachers.filter((x) => x.id !== teacher.id) }));
    } catch (error) {
      reportDataError(error);
    }
  };

  const restorePayment = async (payment) => {
    try {
      await restoreRow("payments", payment.id);
      setPayments((prev) => [...prev, { ...payment, archivedAt: null }]);
      setArchive((prev) => ({ ...prev, payments: prev.payments.filter((x) => x.id !== payment.id) }));
    } catch (error) {
      reportDataError(error);
    }
  };

  const restoreCourse = async (course) => {
    try {
      await restoreRow("courses", course.id);
      setCourses((prev) => [...prev, { ...course, archivedAt: null }]);
      setArchive((prev) => ({ ...prev, courses: (prev.courses || []).filter((x) => x.id !== course.id) }));
    } catch (error) {
      reportDataError(error);
    }
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

  const saveEditStudent = async () => {
    const firstName = editingStudentFirstName.trim();
    const lastName = editingStudentLastName.trim();
    if (!firstName && !lastName) return;
    const nextStudent = {
      name: [firstName, lastName].filter(Boolean).join(" "),
      firstName,
      lastName,
      age: editingStudentAge.trim(),
      city: editingStudentCity.trim(),
      phone: editingStudentPhone.trim(),
      email: editingStudentEmail.trim(),
      course: editingStudentCourse,
      group: editingStudentGroup,
      teacherId: editingStudentTeacherId || null,
    };
    try {
      const savedStudent = await updateRow("students", editingStudentId, studentToRow(nextStudent), normalizeStudent);
      setStudents((prev) => prev.map((student) => (student.id === editingStudentId ? savedStudent || { ...student, ...nextStudent } : student)));
      cancelEditStudent();
    } catch (error) {
      reportDataError(error);
    }
  };

  const startEditTeacher = (teacher) => {
    const nameParts = String(teacher.name || "").split(" ").filter(Boolean);
    setEditingTeacherId(teacher.id);
    setEditingTeacherFirstName(teacher.firstName || nameParts[0] || "");
    setEditingTeacherLastName(teacher.lastName || nameParts.slice(1).join(" "));
    setEditingTeacherPercent(teacher.percent);
  };

  const saveEditTeacher = async () => {
    const firstName = editingTeacherFirstName.trim();
    const lastName = editingTeacherLastName.trim();
    if (!firstName && !lastName) return;
    const nextTeacher = {
      name: [firstName, lastName].filter(Boolean).join(" "),
      firstName,
      lastName,
      percent: Number(editingTeacherPercent),
    };
    try {
      const savedTeacher = await updateRow("teachers", editingTeacherId, teacherToRow(nextTeacher), normalizeTeacher);
      setTeachers((prev) => prev.map((teacher) => (teacher.id === editingTeacherId ? savedTeacher || { ...teacher, ...nextTeacher } : teacher)));
      setEditingTeacherId(null);
      setEditingTeacherFirstName("");
      setEditingTeacherLastName("");
      setEditingTeacherPercent(80);
    } catch (error) {
      reportDataError(error);
    }
  };

  const openAssignStudentsModal = () => {
    const initialTeacherId = selectedTeacherView || teachers[0]?.id || "";
    setAssignTeacherId(initialTeacherId ? String(initialTeacherId) : "");
    setAssignStudentIds(
      initialTeacherId
        ? students.filter((student) => sameId(student.teacherId, initialTeacherId)).map((student) => student.id)
        : []
    );
    setIsAssignStudentsModalOpen(true);
  };

  const changeAssignTeacher = (teacherId) => {
    setAssignTeacherId(teacherId);
    setAssignStudentIds(
      teacherId
        ? students.filter((student) => sameId(student.teacherId, teacherId)).map((student) => student.id)
        : []
    );
  };

  const toggleAssignStudent = (studentId) => {
    setAssignStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const saveAssignedStudents = async () => {
    if (!assignTeacherId) return;
    const nextStudents = students.map((student) => {
        const isSelected = assignStudentIds.some((id) => sameId(id, student.id));
        const belongsToTeacher = sameId(student.teacherId, assignTeacherId);

        if (isSelected) {
          return { ...student, teacherId: assignTeacherId };
        }

        if (belongsToTeacher) {
          return { ...student, teacherId: null };
        }

        return student;
      });
    const changedStudents = nextStudents.filter((student) => {
      const previousStudent = students.find((item) => item.id === student.id);
      return String(previousStudent?.teacherId || "") !== String(student.teacherId || "");
    });

    try {
      const results = await Promise.all(
        changedStudents.map((student) =>
          supabase.from("students").update({ teacher_id: student.teacherId || null }).eq("id", student.id)
        )
      );
      const firstError = results.find((result) => result.error)?.error;
      if (firstError) throw firstError;
      setStudents(nextStudents);
      setSelectedTeacherView(assignTeacherId);
      setIsAssignStudentsModalOpen(false);
    } catch (error) {
      reportDataError(error);
    }
  };

  const startEditPayment = (payment) => {
    setEditingPaymentId(payment.id);
    setEditingPaymentAmount(String(payment.amount));
    setEditingPaymentStudentId(String(payment.studentId));
    setEditingPaymentDate(payment.date ? String(payment.date).slice(0, 10) : "");
    setEditingPaymentNote(payment.note || "");
  };

  const saveEditPayment = async () => {
    if (!editingPaymentAmount || !editingPaymentStudentId || !editingPaymentDate) return;
    const student = students.find((s) => sameId(s.id, editingPaymentStudentId));
    const teacher = teachers.find((t) => sameId(t.id, student?.teacherId));
    const existingPayment = payments.find((payment) => payment.id === editingPaymentId);
    const nextPayment = 
      {
        amount: parseMoney(editingPaymentAmount),
        studentId: editingPaymentStudentId,
        studentName: student?.name || existingPayment?.studentName || "Pa student",
        teacherId: student?.teacherId ?? null,
        teacherName: teacher?.name || existingPayment?.teacherName || "Pa mësues",
        note: editingPaymentNote.trim(),
        date: `${editingPaymentDate}T00:00:00.000Z`,
      };
    try {
      const savedPayment = await updateRow("payments", editingPaymentId, paymentToRow(nextPayment), normalizePayment);
      setPayments((prev) => prev.map((payment) => (payment.id === editingPaymentId ? savedPayment || { ...payment, ...nextPayment } : payment)));
      setEditingPaymentId(null);
      setEditingPaymentAmount("");
      setEditingPaymentStudentId("");
      setEditingPaymentDate("");
      setEditingPaymentNote("");
    } catch (error) {
      reportDataError(error);
    }
  };

  const currentPaymentMonth = monthFromDate(new Date().toISOString());

  const getStudentCourse = (student) => courses.find((course) => course.name === student.course);
  const getStudentCoursePrice = (student) => Number(getStudentCourse(student)?.price || 0);
  const getStudentCurrentPayments = (student) =>
    payments.filter(
      (payment) =>
        sameId(payment.studentId, student.id) &&
        monthFromDate(payment.date) === currentPaymentMonth
    );
  const hasStudentCurrentPayment = (student) => getStudentCurrentPayments(student).length > 0;
  const paymentTeacherPercentValue = (payment, teacher) => Number(payment.teacherPercent ?? teacher?.percent ?? 80);
  const paymentAdminPercentValue = (payment) => Number(payment.adminPercent ?? 15);
  const paymentSchoolPercentValue = (payment) => Number(payment.schoolPercent ?? 5);

  const toggleStudentPayment = async (student) => {
    if (hasStudentCurrentPayment(student)) {
      const currentPayments = getStudentCurrentPayments(student);
      try {
        await Promise.all(currentPayments.map((payment) => deleteRow("payments", payment.id)));
        setPayments((prev) =>
          prev.filter(
            (payment) =>
              !sameId(payment.studentId, student.id) ||
              monthFromDate(payment.date) !== currentPaymentMonth
          )
        );
      } catch (error) {
        reportDataError(error);
      }
      return;
    }

    const course = getStudentCourse(student);
    if (!course) {
      window.alert("Ky kurs nuk ka cmim te caktuar te Kurset.");
      return;
    }

    const teacher = teachers.find((t) => sameId(t.id, student.teacherId));
    const nextPayment = {
      studentId: student.id,
      studentName: student.name || "Pa student",
      teacherId: student.teacherId ?? null,
      teacherName: teacher?.name || "Pa mesues",
      amount: getStudentCoursePrice(student),
      teacherPercent: 80,
      adminPercent: 15,
      schoolPercent: 5,
      note: "",
      date: new Date().toISOString(),
    };
    try {
      const savedPayment = await insertRow("payments", paymentToRow(nextPayment), normalizePayment);
      setPayments((prev) => [...prev, savedPayment]);
    } catch (error) {
      reportDataError(error);
    }
  };

  const filteredStudents = students.filter((student) => {
    const teacher = teachers.find((t) => sameId(t.id, student.teacherId));
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
    (student) => sameId(student.teacherId, selectedTeacherView)
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
    const student = students.find((s) => sameId(s.id, payment.studentId));
    const fallbackTeacherId = payment.teacherId != null ? payment.teacherId : student?.teacherId != null ? student.teacherId : null;
    const teacher = teachers.find((t) => sameId(t.id, fallbackTeacherId));
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
        const teacherStudents = students.filter((student) => sameId(student.teacherId, teacher.id));
        const teacherStudentIds = teacherStudents.map((student) => student.id);
        const relevantPayments = payments.filter((payment) => {
          const sameTeacher = teacherStudentIds.some((studentId) => sameId(studentId, payment.studentId));
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

  const allTimeIncomeOverview = useMemo(() => {
    const paymentTeacherId = (payment) => {
      if (payment.teacherId != null) return payment.teacherId;
      return students.find((student) => sameId(student.id, payment.studentId))?.teacherId ?? null;
    };
    const totalIncome = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const totalAdminShare = payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0) * (paymentAdminPercentValue(payment) / 100),
      0
    );
    const totalSchoolShare = payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0) * (paymentSchoolPercentValue(payment) / 100),
      0
    );
    const teacherRows = teachers.map((teacher) => {
      const total = payments
        .filter((payment) => sameId(paymentTeacherId(payment), teacher.id))
        .reduce(
          (sum, payment) => sum + Number(payment.amount || 0) * (paymentTeacherPercentValue(payment, teacher) / 100),
          0
        );
      return {
        id: teacher.id,
        name: teacher.name,
        total,
      };
    });

    return {
      totalIncome,
      totalAdminShare,
      totalSchoolShare,
      teacherRows,
    };
  }, [payments, students, teachers]);

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
    teacherName: (student) => teachers.find((teacher) => sameId(teacher.id, student.teacherId))?.name || "Pa mesues",
    payment: (student) => (hasStudentCurrentPayment(student) ? 1 : 0),
  });

  const filteredTeachers = teachers.filter((teacher) => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return true;
    const teacherStudents = students.filter((student) => sameId(student.teacherId, teacher.id));
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
    studentsCount: (teacher) => students.filter((student) => sameId(student.teacherId, teacher.id)).length,
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
      const student = students.find((item) => sameId(item.id, payment.studentId));
      const fallbackTeacherId = payment.teacherId != null ? payment.teacherId : student?.teacherId;
      const teacher = teachers.find((item) => sameId(item.id, fallbackTeacherId));
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
    const student = students.find((item) => sameId(item.id, payment.studentId));
    const fallbackTeacherId = payment.teacherId != null ? payment.teacherId : student?.teacherId;
    const teacher = teachers.find((item) => sameId(item.id, fallbackTeacherId));
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
    teacherName: (student) => teachers.find((teacher) => sameId(teacher.id, student.teacherId))?.name || "Pa mesues",
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

  const bulkRestore = async (type) => {
    const ids = archiveSelection[type] || [];
    if (!ids.length) return;

    try {
      const { error } = await supabase.from(type).update({ archived_at: null }).in("id", ids);
      if (error) throw error;

      if (type === "students") {
        const items = archive.students.filter((item) => ids.includes(item.id)).map((item) => ({ ...item, archivedAt: null }));
        setStudents((prev) => [...prev, ...items]);
        setArchive((prev) => ({ ...prev, students: prev.students.filter((item) => !ids.includes(item.id)) }));
      }

      if (type === "teachers") {
        const items = archive.teachers.filter((item) => ids.includes(item.id)).map((item) => ({ ...item, archivedAt: null }));
        setTeachers((prev) => [...prev, ...items]);
        setArchive((prev) => ({ ...prev, teachers: prev.teachers.filter((item) => !ids.includes(item.id)) }));
      }

      if (type === "payments") {
        const items = archive.payments.filter((item) => ids.includes(item.id)).map((item) => ({ ...item, archivedAt: null }));
        setPayments((prev) => [...prev, ...items]);
        setArchive((prev) => ({ ...prev, payments: prev.payments.filter((item) => !ids.includes(item.id)) }));
      }

      if (type === "courses") {
        const items = (archive.courses || []).filter((item) => ids.includes(item.id)).map((item) => ({ ...item, archivedAt: null }));
        setCourses((prev) => [...prev, ...items]);
        setArchive((prev) => ({ ...prev, courses: (prev.courses || []).filter((item) => !ids.includes(item.id)) }));
      }

      setArchiveSelection((prev) => ({ ...prev, [type]: [] }));
    } catch (error) {
      reportDataError(error);
    }
  };

  const deleteArchivedItem = async (type, id) => {
    if (!window.confirm("A je i sigurt qe don me e fshi pergjithmone?")) return;
    try {
      await deleteRow(type, id);
      setArchive((prev) => ({ ...prev, [type]: (prev[type] || []).filter((item) => item.id !== id) }));
      setArchiveSelection((prev) => ({ ...prev, [type]: (prev[type] || []).filter((itemId) => itemId !== id) }));
    } catch (error) {
      reportDataError(error);
    }
  };

  const bulkDeleteArchived = async (type) => {
    if (!window.confirm("A je i sigurt qe don me i fshi keto pergjithmone?")) return;
    const ids = archiveSelection[type] || [];
    if (!ids.length) return;
    try {
      const { error } = await supabase.from(type).delete().in("id", ids);
      if (error) throw error;
      setArchive((prev) => ({ ...prev, [type]: (prev[type] || []).filter((item) => !ids.includes(item.id)) }));
      setArchiveSelection((prev) => ({ ...prev, [type]: [] }));
    } catch (error) {
      reportDataError(error);
    }
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

  if (isAuthLoading) {
    return (
      <div className={`${shell} flex min-h-screen items-center justify-center p-4`} style={{ background: HIGHLIGHT }}>
        <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-xl">
          <div className="mb-4 flex justify-center">
            <BrandMark />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: PRIMARY }}>Vatra e Dituris&euml;</h1>
          <p className="mt-2 text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={`${shell} flex min-h-screen items-center justify-center p-4`} style={{ background: HIGHLIGHT }}>
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-center gap-3">
            <BrandMark />
            <div>
              <h1 className="text-2xl font-bold leading-tight" style={{ color: PRIMARY }}>Vatra e Dituris&euml;</h1>
              <p className="text-sm text-gray-500">Sign in to continue.</p>
            </div>
          </div>

          {!isSupabaseConfigured && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.
            </div>
          )}

          {authError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {authError}
            </div>
          )}

          <div className="flex justify-center">
            <button
              type="button"
              onClick={signInWithGoogle}
              className={mainBtn}
              style={isSupabaseConfigured ? primaryBtnStyle : disabledPrimaryBtnStyle}
              disabled={!isSupabaseConfigured}
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${shell} h-dvh min-h-screen overflow-hidden flex flex-col lg:flex-row`} style={{ background: HIGHLIGHT }}>
      <aside className={`relative w-full ${isSidebarCollapsed ? "lg:w-20" : "lg:w-64"} lg:h-full shrink-0 overflow-hidden border-b lg:border-b-0 lg:border-r ${sidebar} p-3 sm:p-4 flex flex-col sticky top-0 z-40 transition-all duration-200`} style={{ background: PRIMARY }}>
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
        <button
          type="button"
          onClick={() => setIsSettingsModalOpen(true)}
          className={`mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-white transition hover:bg-white/10 ${isSidebarCollapsed ? "lg:justify-center" : "lg:justify-start"}`}
          aria-label="Settings"
          title="Settings"
        >
          <img src={settingsIcon} alt="" className="h-5 w-5" />
          <span className={isSidebarCollapsed ? "lg:hidden" : ""}>Settings</span>
        </button>
      </aside>

      <main className="flex-1 min-h-0 p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 overflow-auto">
        {isDataLoading && (
          <div className="fixed right-4 top-4 z-50 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-sm">
            Loading Supabase data...
          </div>
        )}
        {dataError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {dataError}
          </div>
        )}
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
                    <th className={thClass}>Nr</th>
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
                  {sortedStudents.map((student, index) => {
                    const teacher = teachers.find((t) => sameId(t.id, student.teacherId));
                    const isSelected = selectedStudentView === student.id;
                    const isEditing = editingStudentId === student.id;
                    const hasPayment = hasStudentCurrentPayment(student);
                    return (
                      <tr key={student.id} onClick={() => setSelectedStudentView((prev) => (prev === student.id ? null : student.id))} className={`${rowHover} cursor-pointer ${isSelected ? selectedRow : ""}`}>
                        <td className={tdClass}>{index + 1}</td>
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
                    <th className={thClass}>Nr</th>
                    <th className={thClass}>{sortButton("teachers", "name", "Emri")}</th>
                    <th className={thClass}>{sortButton("teachers", "lastName", "Mbiemri")}</th>
                    <th className={thClass}>Përqindja</th>
                    <th className={thClass}>{sortButton("teachers", "studentsCount", "Nxënës")}</th>
                    <th className={thClass}>Veprime</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTeachers.map((teacher, index) => {
                    const isSelected = selectedTeacherView === teacher.id;
                    const isEditing = editingTeacherId === teacher.id;
                    const countStudents = students.filter((student) => sameId(student.teacherId, teacher.id)).length;
                    return (
                      <tr key={teacher.id} onClick={() => setSelectedTeacherView((prev) => (prev === teacher.id ? null : teacher.id))} className={`${rowHover} cursor-pointer ${isSelected ? selectedRow : ""}`}>
                        <td className={tdClass}>{index + 1}</td>
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
                        <th className={thClass}>Nr</th>
                        <th className={thClass}>{sortButton("selectedTeacherStudents", "name", "Emri")}</th>
                        <th className={thClass}>{sortButton("selectedTeacherStudents", "lastName", "Mbiemri")}</th>
                        <th className={thClass}>{sortButton("selectedTeacherStudents", "course", "Kursi")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTeacherStudents.length > 0 ? (
                        sortedSelectedTeacherStudents.map((student, index) => (
                          <tr key={student.id} className={rowHover}>
                            <td className={tdClass}>{index + 1}</td>
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
                    <th className={thClass}>Nr</th>
                    <th className={thClass}>{sortButton("payments", "studentName", "Nxënësi")}</th>
                    <th className={thClass}>{sortButton("payments", "teacherName", "Mësuesi")}</th>
                    <th className={thClass}>{sortButton("payments", "amount", "Shuma")}</th>
                    <th className={thClass}>{sortButton("payments", "date", "Data")}</th>
                    <th className={thClass}>{sortButton("payments", "note", "Shenime")}</th>
                    <th className={thClass}>Veprime</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPayments.map((payment, index) => {
                    const isEditing = editingPaymentId === payment.id;
                    return (
                      <tr key={payment.id} className={rowHover}>
                        <td className={tdClass}>{index + 1}</td>
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
                    <th className={thClass}>Nr</th>
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
                  {sortedTeacherEarnings.map((teacher, index) => (
                    <tr key={teacher.id} className={rowHover}>
                      <td className={tdClass}>{index + 1}</td>
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

            <div className="mt-6 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
              <span className="font-semibold" style={{ color: PRIMARY }}>Administrata</span>
              <span className="font-bold">
                {formatCurrency(sortedTeacherEarnings.reduce((sum, teacher) => sum + Number(teacher.adminShare || 0), 0))}
              </span>
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

            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium text-white sm:w-64" style={primaryBtnStyle} onClick={() => setIsAllIncomeModalOpen(true)}>
                {actionLabel("information", "Shfaq te gjitha te hyrat")}
              </button>
              <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium text-white sm:w-64" style={secondaryBtnStyle} onClick={openExpenseModal}>{actionLabel("add", "Shto shpenzim")}</button>
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-[26rem]">
                <input className={dateInput} type="month" value={expenseMonthFilter} onChange={(e) => setExpenseMonthFilter(e.target.value)} />
                <button onClick={() => setExpenseMonthFilter("")} className={mainBtn} style={secondaryBtnStyle}>{actionLabel("clear", "Pastro filtrin")}</button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={exportExpensesExcel} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium text-white sm:w-64" style={secondaryBtnStyle}>{actionLabel("export", "Excel shpenzimet")}</button>
                <button onClick={exportExpensesPdf} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium text-white sm:w-64" style={primaryBtnStyle}>{actionLabel("export", "PDF shpenzimet")}</button>
              </div>
            </div>

            <div className={tableWrap}>
              <table className="min-w-[42rem] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={thClass}>Nr</th>
                    <th className={thClass}>{sortButton("finance", "name", "Produkti")}</th>
                    <th className={thClass}>{sortButton("finance", "date", "Data")}</th>
                    <th className={thClass}>{sortButton("finance", "amount", "Çmimi")}</th>
                    <th className={thClass}>Shenime</th>
                    <th className={thClass}>Veprime</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedExpenses.map((expense, index) => {
                    const isEditing = editingExpenseId === expense.id;
                    return (
                      <tr key={expense.id} className={rowHover}>
                        <td className={tdClass}>{index + 1}</td>
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
                    <th className={thClass}>Nr</th>
                    <th className={thClass}>{sortButton("courses", "name", "Emri i kursit")}</th>
                    <th className={thClass}>{sortButton("courses", "price", "Çmimi")}</th>
                    <th className={thClass}>Veprime</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCourses.map((course, index) => {
                    const isEditing = editingCourseId === course.id;
                    return (
                      <tr key={course.id} className={rowHover}>
                        <td className={tdClass}>{index + 1}</td>
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
                      <th className={thClass}>Nr</th>
                      <th className={thClass}>#</th>
                      <th className={thClass}>{sortButton("archive", "name", "Emri")}</th>
                      <th className={thClass}>{sortButton("archive", "teacherName", "Mësuesi")}</th>
                      <th className={thClass}>Veprimi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedArchiveStudents.map((student, index) => {
                      const teacher = teachers.find((t) => sameId(t.id, student.teacherId));
                      return (
                        <tr key={student.id} className={rowHover}>
                          <td className={tdClass}>{index + 1}</td>
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
                      <th className={thClass}>Nr</th>
                      <th className={thClass}>#</th>
                      <th className={thClass}>Emri</th>
                      <th className={thClass}>%</th>
                      <th className={thClass}>Veprimi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedArchiveTeachers.map((teacher, index) => (
                      <tr key={teacher.id} className={rowHover}>
                        <td className={tdClass}>{index + 1}</td>
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
                      <th className={thClass}>Nr</th>
                      <th className={thClass}>#</th>
                      <th className={thClass}>Nxënësi</th>
                      <th className={thClass}>Mësuesi</th>
                      <th className={thClass}>Shuma</th>
                      <th className={thClass}>Data</th>
                      <th className={thClass}>Veprimi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedArchivePayments.map((payment, index) => (
                      <tr key={payment.id} className={rowHover}>
                        <td className={tdClass}>{index + 1}</td>
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
                      <th className={thClass}>Nr</th>
                      <th className={thClass}>#</th>
                      <th className={thClass}>{sortButton("courses", "name", "Emri i kursit")}</th>
                      <th className={thClass}>{sortButton("courses", "price", "Çmimi")}</th>
                      <th className={thClass}>Veprimi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedArchiveCourses.map((course, index) => (
                      <tr key={course.id} className={rowHover}>
                        <td className={tdClass}>{index + 1}</td>
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

        {isAllIncomeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4" onClick={() => setIsAllIncomeModalOpen(false)}>
            <div className="my-4 w-full max-w-2xl rounded-lg bg-white p-4 sm:p-6 shadow-xl space-y-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200">
                  <img src={informationIcon} alt="" className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-xl font-bold" style={{ color: PRIMARY }}>Të gjitha të hyrat</h3>
                  <p className="text-sm text-gray-500">Përmbledhje prej fillimit të shkollës.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <span className="font-medium">Të gjitha të hyrat e shkollës prej fillimit</span>
                  <span className="font-bold">{formatCurrency(allTimeIncomeOverview.totalIncome)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <span className="font-medium">Të gjitha të hyrat e administratës prej fillimit</span>
                  <span className="font-bold">{formatCurrency(allTimeIncomeOverview.totalAdminShare)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <span className="font-medium">Të gjitha të hyrat që i takojnë shkollës</span>
                  <span className="font-bold">{formatCurrency(allTimeIncomeOverview.totalSchoolShare)}</span>
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-bold" style={{ color: PRIMARY }}>Të gjitha pagat prej fillimit për secilin mësues</h4>
                <div className={tableWrap}>
                  <table className="min-w-[28rem] w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className={thClass}>Mësuesi</th>
                        <th className={thClass}>Paga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTimeIncomeOverview.teacherRows.map((teacher) => (
                        <tr key={`all-time-${teacher.id}`} className={rowHover}>
                          <td className={tdClass}>{teacher.name}</td>
                          <td className={tdClass}>{formatCurrency(teacher.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <button type="button" onClick={() => setIsAllIncomeModalOpen(false)} className={smallBtn} style={secondaryBtnStyle}>Close</button>
              </div>
            </div>
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
                {students.some((student) => !student.teacherId || sameId(student.teacherId, assignTeacherId)) ? (
                  students
                    .filter((student) => !student.teacherId || sameId(student.teacherId, assignTeacherId))
                    .map((student) => {
                    const currentTeacher = teachers.find((teacher) => sameId(teacher.id, student.teacherId));
                    const isChecked = assignStudentIds.some((id) => sameId(id, student.id));
                    return (
                      <label key={student.id} className="flex items-start gap-3 border-b border-gray-100 px-3 py-3 last:border-b-0">
                        <input
                          type="checkbox"
                          className={`${roundCheckbox} mt-1`}
                          checked={isChecked}
                          onChange={() => toggleAssignStudent(student.id)}
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

        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4" onClick={() => setIsSettingsModalOpen(false)}>
            <div className="my-4 w-full max-w-md rounded-lg bg-white p-4 sm:p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200">
                  <img src={settingsIcon} alt="" className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-xl font-bold" style={{ color: PRIMARY }}>Settings</h3>
                  <p className="text-sm text-gray-500">{currentUser?.email ? `Signed in as ${currentUser.email}` : "Manage your account."}</p>
                </div>
              </div>

              <div className="flex flex-col gap-8">
                {authError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {authError}
                  </div>
                )}
                {!currentUser && (
                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    className={mainBtn}
                    style={secondaryBtnStyle}
                  >
                    Sign in with Google
                  </button>
                )}
                <button type="button" onClick={signOut} className={mainBtn} style={dangerBtnStyle}>
                  Sign out
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <button type="button" onClick={() => setIsSettingsModalOpen(false)} className={smallBtn} style={secondaryBtnStyle}>Close</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
