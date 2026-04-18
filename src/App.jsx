import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import addIcon from "./assets/add.png";
import archiveIcon from "./assets/archive.png";
import assignIcon from "./assets/assign.png";
import clearIcon from "./assets/clear.png";
import coursesIcon from "./assets/courses.png";
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
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function parseMonthYear(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";
  if (/^\d{4}-\d{2}$/.test(rawValue)) return rawValue;

  const [monthName, year] = rawValue.split(/\s+/);
  const monthMap = {
    janar: "01",
    shkurt: "02",
    mars: "03",
    prill: "04",
    maj: "05",
    qershor: "06",
    korrik: "07",
    gusht: "08",
    shtator: "09",
    tetor: "10",
    nentor: "11",
    nentore: "11",
    dhjetor: "12",
  };
  const month = monthMap[normalizeExcelKey(monthName)];
  return month && year ? `${year}-${month}` : rawValue;
}

function monthIsOnOrBefore(date, targetMonth) {
  const rowMonth = monthFromDate(date);
  return !targetMonth || (rowMonth && rowMonth <= targetMonth);
}

function formatDateDisplay(date) {
  if (!date) return "-";
  const isoValue = String(date).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoValue)) {
    const [year, month, day] = isoValue.split("-");
    return `${day}-${month}-${year}`;
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}-${month}-${year}`;
}

function parseDateInput(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}T00:00:00.000Z`;
    }
  }

  const rawValue = String(value).trim();
  const displayMatch = rawValue.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (displayMatch) {
    const [, day, month, year] = displayMatch;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00.000Z`;
  }

  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function isoDateInputValue(value) {
  if (!value) return "";
  const rawValue = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) return rawValue;
  const parsed = parseDateInput(value);
  return String(parsed).slice(0, 10);
}

function formatDateInputDisplay(value) {
  const isoValue = isoDateInputValue(value);
  if (!isoValue) return "";
  const [year, month, day] = isoValue.split("-");
  return `${day}-${month}-${year}`;
}

function parseDateDisplayValue(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  const displayMatch = rawValue.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  const isoMatch = rawValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const [, day, month, year] = displayMatch || [];
  const [, isoYear, isoMonth, isoDay] = isoMatch || [];
  const finalYear = year || isoYear;
  const finalMonth = month || isoMonth;
  const finalDay = day || isoDay;

  if (!finalYear || !finalMonth || !finalDay) return "";

  const paddedMonth = String(finalMonth).padStart(2, "0");
  const paddedDay = String(finalDay).padStart(2, "0");
  const parsed = new Date(`${finalYear}-${paddedMonth}-${paddedDay}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== Number(finalYear) ||
    parsed.getUTCMonth() + 1 !== Number(finalMonth) ||
    parsed.getUTCDate() !== Number(finalDay)
  ) {
    return "";
  }

  return `${finalYear}-${paddedMonth}-${paddedDay}`;
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
  studentGroup: "",
  teacherId: "",
};

const emptyEnrollmentForm = {
  course: "",
  group: "",
  studentGroup: "",
  teacherId: "",
  status: "active",
  endMonth: "",
  note: "",
};

const emptyTeacherForm = {
  firstName: "",
  lastName: "",
  email: "",
  percent: 80,
};

const emptyCourseForm = {
  name: "",
  price: "",
  pricingType: "fixed",
};

const pricingTypeOptions = [
  { value: "hourly", label: "Me orë" },
  { value: "fixed", label: "Mujore" },
];

const enrollmentStatusOptions = [
  { value: "active", label: "Aktiv" },
  { value: "inactive", label: "Joaktiv" },
  { value: "paused", label: "Pauzë" },
  { value: "completed", label: "Përfunduar" },
];

const SCHOOL_SHARE_CAP_START_MONTH = "2026-04";
const SCHOOL_SHARE_CAP_AMOUNT = 30;

function enrollmentStatusLabel(status) {
  return enrollmentStatusOptions.find((option) => option.value === status)?.label || "Aktiv";
}

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

function getWorkbookRows(workbook, sheetNames) {
  const normalizedNames = sheetNames.map(normalizeExcelKey);
  const sheetName = workbook.SheetNames.find((name) => normalizedNames.includes(normalizeExcelKey(name)));
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
}

function sheetFromRows(rows) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = rows[0]?.map((_, columnIndex) => ({
    wch: Math.min(
      Math.max(
        ...rows.map((row) => String(row[columnIndex] ?? "").length),
        10
      ) + 2,
      40
    ),
  }));
  return worksheet;
}

function sameId(a, b) {
  return String(a ?? "") === String(b ?? "");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function compareText(first, second) {
  return String(first || "").localeCompare(String(second || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function studentOptionLabel(student) {
  const name = student?.name || [student?.firstName, student?.lastName].filter(Boolean).join(" ") || "Pa student";
  return student?.studentGroup ? `${name} - ${student.studentGroup}` : name;
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Zgjedh",
  searchPlaceholder = "Kërko...",
  className = "",
  disabled = false,
  onOpen,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const selectedOption = options.find((option) => sameId(option.value, value));
  const filteredOptions = options.filter((option) =>
    String(option.label || "").toLowerCase().includes(query.trim().toLowerCase())
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => searchRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const chooseOption = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative min-w-0" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className={`${className} flex items-center justify-between gap-2 text-left ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        onClick={() => {
          if (!disabled) {
            onOpen?.();
            setIsOpen((prev) => !prev);
          }
        }}
        disabled={disabled}
      >
        <span className={`truncate ${selectedOption ? "" : "text-gray-500"}`}>
          {selectedOption?.label || placeholder}
        </span>
        <span className="shrink-0 text-xs text-gray-500">▼</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-[80] mt-1 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
          <input
            ref={searchRef}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#54807f]"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
          />
          <div className="mt-2 max-h-56 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                    sameId(option.value, value) ? "bg-[#80a68a] text-white hover:bg-[#80a68a]" : "text-gray-900"
                  }`}
                  onClick={() => chooseOption(option.value)}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">Nuk u gjet asnje rezultat.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DateTextInput({ value, onChange, className = "", placeholder = "DD-MM-YYYY", ...props }) {
  const [displayValue, setDisplayValue] = useState(formatDateInputDisplay(value));

  useEffect(() => {
    setDisplayValue(formatDateInputDisplay(value));
  }, [value]);

  const commitValue = (nextDisplayValue) => {
    const parsedValue = parseDateDisplayValue(nextDisplayValue);
    if (parsedValue) {
      onChange(parsedValue);
      setDisplayValue(formatDateInputDisplay(parsedValue));
      return;
    }

    if (!nextDisplayValue.trim()) {
      onChange("");
      setDisplayValue("");
      return;
    }

    setDisplayValue(formatDateInputDisplay(value));
  };

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      className={className}
      value={displayValue}
      onChange={(event) => {
        const nextValue = event.target.value.replace(/[^\d/-]/g, "");
        setDisplayValue(nextValue);
        const parsedValue = parseDateDisplayValue(nextValue);
        if (parsedValue) onChange(parsedValue);
      }}
      onBlur={() => commitValue(displayValue)}
      placeholder={placeholder}
    />
  );
}

function authRedirectUrl() {
  const configuredUrl = import.meta.env.VITE_SUPABASE_REDIRECT_URL?.trim();
  const fallbackUrl = window.location.origin;
  if (!configuredUrl) return fallbackUrl;

  const normalizedUrl = /^https?:\/\//i.test(configuredUrl)
    ? configuredUrl
    : `https://${configuredUrl}`;

  try {
    return new URL(normalizedUrl).origin;
  } catch {
    return fallbackUrl;
  }
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
  const [enrollments, setEnrollments] = useState([]);
  const [archive, setArchive] = useState({
    students: [],
    teachers: [],
    payments: [],
    courses: [],
    expenses: [],
  });
  const [expenses, setExpenses] = useState([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [dataError, setDataError] = useState("");

  const [activeView, setActiveView] = useState("students");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedTeacherView, setSelectedTeacherView] = useState(null);
  const [selectedPagaTeacherView, setSelectedPagaTeacherView] = useState(null);
  const [selectedStudentView, setSelectedStudentView] = useState(null);
  const [detailsStudentId, setDetailsStudentId] = useState(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDuplicateMergeModalOpen, setIsDuplicateMergeModalOpen] = useState(false);
  const [isAllIncomeModalOpen, setIsAllIncomeModalOpen] = useState(false);
  const [isMonthEndReminderDismissed, setIsMonthEndReminderDismissed] = useState(false);
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const studentImportRef = useRef(null);
  const allDataImportRef = useRef(null);

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [studentForm, setStudentForm] = useState(emptyStudentForm);
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [enrollmentStudentId, setEnrollmentStudentId] = useState("");
  const [enrollmentForm, setEnrollmentForm] = useState({ ...emptyEnrollmentForm, group: currentMonthInput() });
  const [editingEnrollmentId, setEditingEnrollmentId] = useState(null);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [teacherForm, setTeacherForm] = useState(emptyTeacherForm);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [courseForm, setCourseForm] = useState(emptyCourseForm);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editingCourseName, setEditingCourseName] = useState("");
  const [editingCoursePrice, setEditingCoursePrice] = useState("");
  const [editingCoursePricingType, setEditingCoursePricingType] = useState("fixed");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentModalTitle, setPaymentModalTitle] = useState("Shto pagesë");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedPaymentEnrollmentId, setSelectedPaymentEnrollmentId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentHours, setPaymentHours] = useState("");
  const [paymentRate, setPaymentRate] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentDate, setPaymentDate] = useState(currentDateInput());
  const [paymentTeacherPercent, setPaymentTeacherPercent] = useState(80);
  const [paymentAdminPercent, setPaymentAdminPercent] = useState(15);
  const [paymentSchoolPercent, setPaymentSchoolPercent] = useState(5);

  const [studentSearch, setStudentSearch] = useState("");
  const [studentGroupFilter, setStudentGroupFilter] = useState(currentMonthInput());
  const [studentStatusFilter, setStudentStatusFilter] = useState("active");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherMonthFilter, setTeacherMonthFilter] = useState(currentMonthInput());
  const [courseSearch, setCourseSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentTeacherFilter, setPaymentTeacherFilter] = useState("");
  const [paymentMonthFilter, setPaymentMonthFilter] = useState(currentMonthInput());
  const [financeMonth, setFinanceMonth] = useState(currentMonthInput());
  const [financeOverviewMonth, setFinanceOverviewMonth] = useState(currentMonthInput());
  const [financeTeacherFilter, setFinanceTeacherFilter] = useState("");
  const [archiveSearch, setArchiveSearch] = useState("");

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseName, setExpenseName] = useState("");
  const [expenseDate, setExpenseDate] = useState(currentDateInput());
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
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
  const [editingStudentStudentGroup, setEditingStudentStudentGroup] = useState("");
  const [editingStudentTeacherId, setEditingStudentTeacherId] = useState("");

  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editingTeacherFirstName, setEditingTeacherFirstName] = useState("");
  const [editingTeacherLastName, setEditingTeacherLastName] = useState("");
  const [editingTeacherEmail, setEditingTeacherEmail] = useState("");
  const [editingTeacherPercent, setEditingTeacherPercent] = useState(80);
  const [isAssignStudentsModalOpen, setIsAssignStudentsModalOpen] = useState(false);
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [assignStudentIds, setAssignStudentIds] = useState([]);

  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [editingPaymentAmount, setEditingPaymentAmount] = useState("");
  const [editingPaymentStudentId, setEditingPaymentStudentId] = useState("");
  const [editingPaymentEnrollmentId, setEditingPaymentEnrollmentId] = useState("");
  const [editingPaymentDate, setEditingPaymentDate] = useState("");
  const [editingPaymentNote, setEditingPaymentNote] = useState("");
  const [editingPaymentHours, setEditingPaymentHours] = useState("");
  const [editingPaymentRate, setEditingPaymentRate] = useState("");
  const [editingPaymentType, setEditingPaymentType] = useState("fixed");
  const [isFinanceExportNoteModalOpen, setIsFinanceExportNoteModalOpen] = useState(false);
  const [pendingFinanceExportType, setPendingFinanceExportType] = useState("");
  const [financeExportNote, setFinanceExportNote] = useState("");

  const [archiveSelection, setArchiveSelection] = useState({
    students: [],
    teachers: [],
    payments: [],
    courses: [],
    expenses: [],
  });
  const [sortConfig, setSortConfig] = useState({
    students: { key: "firstName", direction: "asc" },
    teachers: { key: "name", direction: "asc" },
    payments: { key: "date", direction: "desc" },
    paga: { key: "name", direction: "asc" },
    finance: { key: "date", direction: "desc" },
    courses: { key: "name", direction: "asc" },
    enrollments: { key: "group", direction: "desc" },
    selectedTeacherStudents: { key: "nr", direction: "asc" },
    archive: { key: "name", direction: "asc" },
    archiveExpenses: { key: "date", direction: "desc" },
  });

  const percentOptions = [60, 65, 70, 75, 80];
  const studentStatusOptions = [
    { value: "active", label: "Aktiv" },
    { value: "inactive", label: "Joaktiv" },
    { value: "paused", label: "Pauzë" },
    { value: "completed", label: "Përfunduar" },
    { value: "", label: "Të gjithë" },
  ];

  const shell = "text-gray-900";
  const sidebar = "border-gray-200";
  const card = "bg-white border-gray-200";
  const input =
    "w-full min-w-0 max-w-full rounded-lg border bg-white border-gray-300 text-gray-900 px-3 py-2 text-sm sm:text-base outline-none focus:ring-2 focus:border-transparent";
  const dateInput = `${input} h-11 appearance-none leading-normal`;
  const smallBtn = "app-button inline-flex items-center justify-center gap-2 px-3 py-2 sm:py-1.5 rounded-lg text-sm font-medium transition text-white";
  const mainBtn = "app-button inline-flex items-center justify-center gap-2 w-full sm:w-auto rounded-lg text-white font-medium px-4 py-2";
  const thClass = "px-3 sm:px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap";
  const tdClass = "px-3 sm:px-4 py-4 align-middle whitespace-nowrap";
  const tableWrap = "overflow-x-auto rounded-lg py-2";
  const roundCheckbox = "h-4 w-4 appearance-none rounded-full border border-gray-300 bg-white checked:border-[#54807f] checked:bg-[#54807f] focus:outline-none focus:ring-2 focus:ring-[#80a68a]";
  const rowHover = "hover:bg-gray-50";
  const selectedRow = "[&>td]:bg-[#80a68a] [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg";
  const sortBtnClass = "flex items-center gap-1 uppercase tracking-wide";

  const buttonStyle = (base, hover, active, extra = {}) => ({
    "--btn-bg": base,
    "--btn-hover": hover,
    "--btn-active": active,
    background: "var(--btn-bg)",
    ...extra,
  });
  const primaryBtnStyle = buttonStyle(SECONDARY, "#4b7372", "#416866");
  const secondaryBtnStyle = buttonStyle(SECONDARY, "#4b7372", "#416866");
  const warningBtnStyle = buttonStyle(WARNING, "#c19512", "#aa830e");
  const dangerBtnStyle = buttonStyle(DANGER, "#ad3326", "#972d22");
  const activeNavStyle = { background: HIGHLIGHT, color: "white" };
  const inactiveNavStyle = { color: "white" };
  const disabledPrimaryBtnStyle = buttonStyle(SECONDARY, SECONDARY, SECONDARY, { color: "white", cursor: "not-allowed", opacity: 0.55 });
  const currentUser = session?.user;
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || "shtepiaediturise@gmail.com")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
  const currentUserEmail = normalizeEmail(currentUser?.email);
  const isAdminUser = Boolean(currentUserEmail && adminEmails.includes(currentUserEmail));
  const currentTeacherAccount = teachers.find((teacher) => normalizeEmail(teacher.email) === currentUserEmail);
  const currentTeacherId = currentTeacherAccount?.id ?? null;
  const isTeacherUser = Boolean(currentTeacherAccount && !isAdminUser);
  const hasAppAccess = isAdminUser || Boolean(currentTeacherAccount);
  const canManageData = isAdminUser;
  const today = new Date();
  const isLastDayOfMonth = today.getDate() === new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const icons = {
    search: searchIcon,
    clear: clearIcon,
    courses: coursesIcon,
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

  const clearRowSelections = () => {
    setSelectedStudentView(null);
    setSelectedTeacherView(null);
    setSelectedPagaTeacherView(null);
  };

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

  const enrollmentStatusRank = (status) => {
    if (status === "active") return 0;
    if (status === "paused") return 1;
    if (status === "completed") return 2;
    return 3;
  };

  const studentEnrollmentRows = (studentId) =>
    enrollments
      .filter((enrollment) => sameId(enrollment.studentId, studentId))
      .sort((first, second) => {
        const statusSort = enrollmentStatusRank(first.status) - enrollmentStatusRank(second.status);
        if (statusSort) return statusSort;
        return compareText(second.group || second.createdAt, first.group || first.createdAt);
      });

  const activeEnrollmentForStudent = (student) => studentEnrollmentRows(student.id)[0] || null;
  const paymentEnrollmentOptionsForStudent = (studentId) => {
    const rows = studentEnrollmentRows(studentId).filter((enrollment) => !enrollment.archivedAt);
    return rows.length ? rows : [];
  };
  const paymentEnrollmentLabel = (enrollment) =>
    [enrollment.course || "Pa kurs", formatMonthYear(enrollment.group), enrollment.studentGroup || ""]
      .filter(Boolean)
      .join(" - ");

  const enrichStudentWithEnrollment = (student) => {
    const enrollment = activeEnrollmentForStudent(student);
    const course = courses.find((item) => sameId(item.id, enrollment?.courseId) || item.name === enrollment?.course);
    const teacher = teachers.find((item) => sameId(item.id, enrollment?.teacherId));
    return {
      ...student,
      enrollmentId: enrollment?.id || "",
      courseId: course?.id || enrollment?.courseId || "",
      course: enrollment?.course || student.course || "",
      group: enrollment?.group || student.group || "",
      studentGroup: enrollment?.studentGroup || student.studentGroup || "",
      teacherId: enrollment?.teacherId ?? student.teacherId ?? null,
      teacherName: teacher?.name || enrollment?.teacherName || "",
      enrollmentStatus: enrollment?.status || "active",
      enrollmentEndMonth: enrollment?.endMonth || "",
      enrollmentNote: enrollment?.note || "",
    };
  };

  const studentsWithEnrollment = useMemo(
    () => students.map((student) => enrichStudentWithEnrollment(student)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, enrollments, courses, teachers]
  );
  const duplicateStudentGroups = useMemo(() => {
    const groups = students.reduce((result, student) => {
      const firstName = normalizeExcelKey(student.firstName || student.name?.split(" ")?.[0] || "");
      const lastName = normalizeExcelKey(student.lastName || student.name?.split(" ").slice(1).join(" ") || "");
      if (!firstName || !lastName) return result;
      const key = `${firstName}::${lastName}`;
      if (!result[key]) result[key] = [];
      result[key].push(student);
      return result;
    }, {});

    return Object.values(groups)
      .filter((group) => group.length > 1)
      .sort((first, second) => compareText(first[0]?.name, second[0]?.name));
  }, [students]);
  const duplicateStudentFieldScore = (student) =>
    [student.age, student.city, student.phone, student.email].filter(Boolean).length;
  const duplicateStudentMonthValue = (student) => activeEnrollmentForStudent(student)?.group || student.group || "";
  const rankDuplicateStudents = (group) =>
    [...group].sort((first, second) => {
      const fieldDiff = duplicateStudentFieldScore(second) - duplicateStudentFieldScore(first);
      if (fieldDiff) return fieldDiff;
      const monthSort = compareText(duplicateStudentMonthValue(second), duplicateStudentMonthValue(first));
      if (monthSort) return monthSort;
      return compareText(String(second.id), String(first.id));
    });
  const duplicateStudentMeta = (student) => {
    const latestEnrollment = studentEnrollmentRows(student.id)[0] || null;
    const teacher = teachers.find((item) => sameId(item.id, latestEnrollment?.teacherId ?? student.teacherId));
    return {
      course: latestEnrollment?.course || student.course || "Pa kurs",
      month: formatMonthYear(latestEnrollment?.group || student.group || ""),
      group: latestEnrollment?.studentGroup || student.studentGroup || "-",
      teacherName: teacher?.name || "Pa mesues",
      paymentsCount: payments.filter((payment) => sameId(payment.studentId, student.id)).length,
      enrollmentsCount: studentEnrollmentRows(student.id).length,
    };
  };
  const duplicateMergePreviewGroups = duplicateStudentGroups.map((group) => {
    const rankedStudents = rankDuplicateStudents(group);
    const primaryStudent = rankedStudents[0];
    const duplicateStudents = rankedStudents.slice(1);
    const groupStudentIds = rankedStudents.map((student) => student.id);
    const groupEnrollments = enrollments
      .filter((enrollment) => groupStudentIds.some((id) => sameId(id, enrollment.studentId)))
      .sort((first, second) => compareText(second.group || "", first.group || ""));

    return {
      primaryStudent,
      duplicateStudents,
      latestEnrollment: groupEnrollments[0] || null,
      totalEnrollments: groupEnrollments.length,
      movedPayments: payments.filter((payment) =>
        duplicateStudents.some((student) => sameId(student.id, payment.studentId))
      ).length,
    };
  });

  const sortedCoursesAlpha = useMemo(
    () => [...courses].sort((first, second) => compareText(first.name, second.name)),
    [courses]
  );
  const sortedTeachersAlpha = useMemo(
    () => [...teachers].sort((first, second) => compareText(first.name, second.name)),
    [teachers]
  );
  const sortedStudentsAlpha = useMemo(
    () => [...studentsWithEnrollment].sort((first, second) => compareText(studentOptionLabel(first), studentOptionLabel(second))),
    [studentsWithEnrollment]
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
    studentGroup: row.student_group || "",
    teacherId: row.teacher_id,
    archivedAt: row.archived_at,
  });

  const normalizeTeacher = (row) => ({
    id: row.id,
  name: row.name || [row.first_name, row.last_name].filter(Boolean).join(" "),
  firstName: row.first_name || "",
  lastName: row.last_name || "",
  email: row.email || "",
  percent: Number(row.percent ?? 80),
  archivedAt: row.archived_at,
});

  const normalizeCourse = (row) => ({
    id: row.id,
    name: row.name || "",
    price: Number(row.price || 0),
    pricingType: row.pricing_type || "fixed",
    archivedAt: row.archived_at,
  });

  const normalizeEnrollment = (row) => ({
    id: row.id,
    studentId: row.student_id,
    courseId: row.course_id || "",
    course: row.course_name || "",
    teacherId: row.teacher_id,
    teacherName: row.teacher_name || "",
    group: row.start_month || "",
    endMonth: row.end_month || "",
    studentGroup: row.group_name || "",
    status: row.status || "active",
    note: row.note || "",
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  });

  const normalizePayment = (row) => ({
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name || "",
    enrollmentId: row.enrollment_id || "",
    courseId: row.course_id || "",
    courseName: row.course_name || "",
    groupName: row.group_name || "",
    paymentMonth: row.payment_month || monthFromDate(row.date),
    teacherId: row.teacher_id,
    teacherName: row.teacher_name || "",
    amount: Number(row.amount || 0),
    teacherPercent: Number(row.teacher_percent ?? 80),
    adminPercent: Number(row.admin_percent ?? 15),
    schoolPercent: Number(row.school_percent ?? 5),
    paymentType: row.payment_type || "fixed",
    hours: row.hours == null ? "" : String(row.hours),
    rate: row.rate == null ? "" : Number(row.rate || 0),
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
    student_group: student.studentGroup || null,
    teacher_id: student.teacherId ?? null,
  });

  const teacherToRow = (teacher) => ({
  name: teacher.name,
  first_name: teacher.firstName,
  last_name: teacher.lastName,
  email: teacher.email || null,
  percent: Number(teacher.percent),
});

  const courseToRow = (course) => ({
    name: course.name,
    price: Number(course.price || 0),
    pricing_type: course.pricingType || "fixed",
  });

  const enrollmentToRow = (enrollment) => {
    const course = courses.find((item) => item.name === enrollment.course || sameId(item.id, enrollment.courseId));
    const teacher = teachers.find((item) => sameId(item.id, enrollment.teacherId));
    return {
      student_id: enrollment.studentId == null ? null : String(enrollment.studentId),
      course_id: course?.id == null ? enrollment.courseId || null : String(course.id),
      course_name: enrollment.course || course?.name || "",
      teacher_id: enrollment.teacherId == null || enrollment.teacherId === "" ? null : String(enrollment.teacherId),
      teacher_name: teacher?.name || enrollment.teacherName || "",
      start_month: enrollment.group || null,
      end_month: enrollment.endMonth || null,
      group_name: enrollment.studentGroup || null,
      status: enrollment.status || "active",
      note: enrollment.note || "",
    };
  };

  const paymentToRow = (payment) => ({
    student_id: payment.studentId ?? null,
    student_name: payment.studentName,
    enrollment_id: payment.enrollmentId || null,
    course_id: payment.courseId || null,
    course_name: payment.courseName || "",
    group_name: payment.groupName || "",
    payment_month: payment.paymentMonth || monthFromDate(payment.date),
    teacher_id: payment.teacherId ?? null,
    teacher_name: payment.teacherName,
    amount: Number(payment.amount || 0),
    teacher_percent: Number(payment.teacherPercent ?? 80),
    admin_percent: Number(payment.adminPercent ?? 15),
    school_percent: Number(payment.schoolPercent ?? 5),
    payment_type: payment.paymentType || "fixed",
    hours: payment.hours === "" || payment.hours == null ? null : Number(payment.hours),
    rate: payment.rate === "" || payment.rate == null ? null : Number(payment.rate),
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

    const [studentsResult, teachersResult, coursesResult, enrollmentsResult, paymentsResult, expensesResult] = await Promise.all([
      supabase.from("students").select("*"),
      supabase.from("teachers").select("*"),
      supabase.from("courses").select("*"),
      supabase.from("enrollments").select("*"),
      supabase.from("payments").select("*"),
      supabase.from("expenses").select("*"),
    ]);

    const enrollmentsTableMissing =
      enrollmentsResult.error &&
      (enrollmentsResult.error.code === "42P01" || enrollmentsResult.error.message?.toLowerCase().includes("enrollments"));
    const firstError = [
      studentsResult,
      teachersResult,
      coursesResult,
      enrollmentsTableMissing ? { error: null } : enrollmentsResult,
      paymentsResult,
      expensesResult,
    ].find((result) => result.error)?.error;
    if (firstError) {
      setDataError(firstError.message);
      setHasLoadedData(true);
      if (showLoading) setIsDataLoading(false);
      return;
    }

    const nextStudents = splitArchived(studentsResult.data || [], normalizeStudent);
    const nextTeachers = splitArchived(teachersResult.data || [], normalizeTeacher);
    const nextCourses = splitArchived(coursesResult.data || [], normalizeCourse);
    const nextEnrollments = enrollmentsTableMissing
      ? { active: [], archived: [] }
      : splitArchived(enrollmentsResult.data || [], normalizeEnrollment);
    const nextPayments = splitArchived(paymentsResult.data || [], normalizePayment);
    const nextExpenses = splitArchived(expensesResult.data || [], normalizeExpense);

    setStudents(nextStudents.active);
    setTeachers(nextTeachers.active);
    setCourses(nextCourses.active);
    setEnrollments(nextEnrollments.active);
    setPayments(nextPayments.active);
    setExpenses(nextExpenses.active);
    setArchive({
      students: nextStudents.archived,
      teachers: nextTeachers.archived,
      courses: nextCourses.archived,
      payments: nextPayments.archived,
      expenses: nextExpenses.archived,
    });
    setHasLoadedData(true);
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

  const mergeDuplicateStudents = () => {
    if (!duplicateStudentGroups.length) {
      window.alert("Nuk u gjet asnje duplikat me emer dhe mbiemer identik.");
      return;
    }

    setIsDuplicateMergeModalOpen(true);
  };

  const applyDuplicateStudentMerge = async () => {
    if (!duplicateStudentGroups.length) {
      window.alert("Nuk u gjet asnje duplikat me emer dhe mbiemer identik.");
      return;
    }

    setIsDuplicateMergeModalOpen(false);

    try {
      for (const group of duplicateStudentGroups) {
        const rankedStudents = rankDuplicateStudents(group);
        const primaryStudent = rankedStudents[0];
        const duplicateStudents = rankedStudents.slice(1);
        if (!duplicateStudents.length) continue;

        const mergedStudent = duplicateStudents.reduce(
          (student, duplicate) => ({
            ...student,
            age: student.age || duplicate.age || "",
            city: student.city || duplicate.city || "",
            phone: student.phone || duplicate.phone || "",
            email: student.email || duplicate.email || "",
          }),
          primaryStudent
        );
        const combinedEnrollments = enrollments
          .filter((enrollment) =>
            [primaryStudent.id, ...duplicateStudents.map((student) => student.id)].some((id) => sameId(id, enrollment.studentId))
          )
          .sort((first, second) => compareText(second.group || "", first.group || ""));
        const latestEnrollmentId = combinedEnrollments[0]?.id || null;

        const updatedPrimary = await updateRow("students", primaryStudent.id, studentToRow(mergedStudent), normalizeStudent);
        setStudents((prev) => prev.map((student) => (sameId(student.id, primaryStudent.id) ? updatedPrimary || mergedStudent : student)));

        const latestEnrollment = combinedEnrollments.find((enrollment) => sameId(enrollment.id, latestEnrollmentId)) || null;
        const historicalEnrollments = combinedEnrollments.filter((enrollment) => !sameId(enrollment.id, latestEnrollmentId));

        for (const enrollment of historicalEnrollments) {
          if (enrollment.status !== "active") continue;
          const closedEnrollment = {
            ...enrollment,
            status: "completed",
            endMonth: enrollment.endMonth || enrollment.group || currentMonthInput(),
          };
          const closeResult = await supabase
            .from("enrollments")
            .update(enrollmentToRow(closedEnrollment))
            .eq("id", enrollment.id);
          if (closeResult.error) throw closeResult.error;
        }

        for (const enrollment of historicalEnrollments) {
          const nextEnrollment = {
            ...enrollment,
            studentId: primaryStudent.id,
            status: enrollment.status === "active" ? "completed" : enrollment.status,
            endMonth: enrollment.endMonth || enrollment.group || currentMonthInput(),
          };
          const moveResult = await supabase
            .from("enrollments")
            .update(enrollmentToRow(nextEnrollment))
            .eq("id", enrollment.id);
          if (moveResult.error) throw moveResult.error;
        }

        if (latestEnrollment) {
          const nextLatestEnrollment = {
            ...latestEnrollment,
            studentId: primaryStudent.id,
            status: "active",
            endMonth: "",
          };
          const latestResult = await supabase
            .from("enrollments")
            .update(enrollmentToRow(nextLatestEnrollment))
            .eq("id", latestEnrollment.id);
          if (latestResult.error) throw latestResult.error;

          const syncedPrimaryStudent = {
            ...mergedStudent,
            course: nextLatestEnrollment.course || mergedStudent.course || "",
            group: nextLatestEnrollment.group || mergedStudent.group || "",
            studentGroup: nextLatestEnrollment.studentGroup || mergedStudent.studentGroup || "",
            teacherId: nextLatestEnrollment.teacherId || mergedStudent.teacherId || null,
          };
          const syncedPrimaryResult = await updateRow("students", primaryStudent.id, studentToRow(syncedPrimaryStudent), normalizeStudent);
          setStudents((prev) =>
            prev.map((student) => (sameId(student.id, primaryStudent.id) ? syncedPrimaryResult || syncedPrimaryStudent : student))
          );
        }

        for (const duplicate of duplicateStudents) {
          const paymentsResult = await supabase
            .from("payments")
            .update({ student_id: primaryStudent.id, student_name: mergedStudent.name })
            .eq("student_id", duplicate.id);
          if (paymentsResult.error) throw paymentsResult.error;

          const archiveDuplicate = await supabase
            .from("students")
            .update({ archived_at: new Date().toISOString() })
            .eq("id", duplicate.id);
          if (archiveDuplicate.error) throw archiveDuplicate.error;
        }
      }

      await loadSupabaseData({ showLoading: false });
      window.alert("Duplikatet u bashkuan. Kontrolloji edhe njehere regjistrimet te Kurset.");
    } catch (error) {
      reportDataError(error);
    }
  };

  const buildEnrollmentFromStudent = (student, studentId, overrides = {}) => {
    const course = courses.find((item) => item.name === student.course || sameId(item.id, student.courseId));
    const teacher = teachers.find((item) => sameId(item.id, student.teacherId));
    return {
      studentId,
      courseId: course?.id || student.courseId || "",
      course: student.course || course?.name || "",
      group: student.group || "",
      studentGroup: student.studentGroup || "",
      teacherId: student.teacherId || null,
      teacherName: teacher?.name || "",
      status: "active",
      endMonth: "",
      note: "",
      ...overrides,
    };
  };

  const currentActiveEnrollmentForStudent = (studentId) =>
    enrollments.find((enrollment) => sameId(enrollment.studentId, studentId) && enrollment.status === "active");

  const saveEnrollment = async (enrollment, existingId = null) => {
    if (existingId) {
      const savedEnrollment = await updateRow("enrollments", existingId, enrollmentToRow(enrollment), normalizeEnrollment);
      setEnrollments((prev) =>
        prev.map((item) => (sameId(item.id, existingId) ? savedEnrollment || { ...item, ...enrollment, id: existingId } : item))
      );
      return savedEnrollment || { ...enrollment, id: existingId };
    }

    const savedEnrollment = await insertRow("enrollments", enrollmentToRow(enrollment), normalizeEnrollment);
    setEnrollments((prev) => [...prev, savedEnrollment]);
    return savedEnrollment;
  };

  const saveActiveEnrollmentForStudent = async (studentId, student) => {
    if (!student.course) return null;
    const existingEnrollment = currentActiveEnrollmentForStudent(studentId) || studentEnrollmentRows(studentId)[0];
    return saveEnrollment(
      buildEnrollmentFromStudent(student, studentId, {
        status: "active",
        endMonth: "",
        note: existingEnrollment?.note || "",
      }),
      existingEnrollment?.id || null
    );
  };

  const updateStudentMirrorFromEnrollment = async (studentId, enrollment) => {
    const student = students.find((item) => sameId(item.id, studentId));
    if (!student) return null;
    const nextStudent = {
      ...student,
      course: enrollment.course || "",
      group: enrollment.group || "",
      studentGroup: enrollment.studentGroup || "",
      teacherId: enrollment.teacherId || null,
    };
    const savedStudent = await updateRow("students", studentId, studentToRow(nextStudent), normalizeStudent);
    setStudents((prev) => prev.map((item) => (sameId(item.id, studentId) ? savedStudent || nextStudent : item)));
    return savedStudent || nextStudent;
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
      setHasLoadedData(false);
      loadSupabaseData();
    } else {
      setHasLoadedData(false);
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
      if (table === "enrollments") {
        if (isDelete) {
          setEnrollments((prev) => removeById(prev, id));
          return;
        }
        const normalizedEnrollment = normalizeEnrollment(payload.new);
        if (normalizedEnrollment.archivedAt) {
          setEnrollments((prev) => removeById(prev, normalizedEnrollment.id));
          return;
        }
        setEnrollments((prev) => upsertById(prev, normalizedEnrollment));
      }
      if (table === "payments") syncActiveAndArchive(setPayments, "payments", normalizePayment);
      if (table === "expenses") syncActiveAndArchive(setExpenses, "expenses", normalizeExpense);
    };

    const channel = supabase.channel("app-data-realtime");
    ["students", "teachers", "courses", "enrollments", "payments", "expenses"].forEach((table) => {
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

    const redirectTo = authRedirectUrl();
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

  const isHourlyCourse = (course) => (course?.pricingType || "fixed") === "hourly";
  const hourlyPaymentAmount = (hours, rate) => Number(hours || 0) * parseMoney(rate);
  const pricingTypeLabel = (type) => ((type || "fixed") === "hourly" ? "Me orë" : "Mujore");

  useEffect(() => {
    setPayments((prev) => {
      let changed = false;
      const next = prev.map((payment) => {
        const enrollment = enrollments.find((item) => sameId(item.id, payment.enrollmentId));
        const student = studentsWithEnrollment.find((s) => sameId(s.id, payment.studentId));
        const fallbackTeacherId =
          payment.teacherId != null ? payment.teacherId : enrollment?.teacherId != null ? enrollment.teacherId : student?.teacherId ?? null;
        const teacher = teachers.find((t) => sameId(t.id, fallbackTeacherId));
        const patched = {
          ...payment,
          studentName: payment.studentName || student?.name || "Pa student",
          teacherId: payment.teacherId != null ? payment.teacherId : enrollment?.teacherId != null ? enrollment.teacherId : student?.teacherId ?? null,
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
        const enrollment = enrollments.find((item) => sameId(item.id, payment.enrollmentId));
        const student = studentsWithEnrollment.find((s) => sameId(s.id, payment.studentId));
        const fallbackTeacherId =
          payment.teacherId != null ? payment.teacherId : enrollment?.teacherId != null ? enrollment.teacherId : student?.teacherId ?? null;
        const teacher = teachers.find((t) => sameId(t.id, fallbackTeacherId));
        const patched = {
          ...payment,
          studentName: payment.studentName || student?.name || "Pa student",
          teacherId: payment.teacherId != null ? payment.teacherId : enrollment?.teacherId != null ? enrollment.teacherId : student?.teacherId ?? null,
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
  }, [studentsWithEnrollment, enrollments, teachers, setPayments, setArchive]);

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
      group: studentForm.group || currentMonthInput(),
      studentGroup: studentForm.studentGroup.trim(),
      teacherId: studentForm.teacherId || null,
    };

    try {
      const savedStudent = await insertRow("students", studentToRow(nextStudent), normalizeStudent);
      await saveEnrollment(buildEnrollmentFromStudent(nextStudent, savedStudent.id));
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
            group: parseMonthYear(getExcelValue(row, ["Muaji", "Month", "Month Year"])),
            studentGroup: getExcelValue(row, ["Grupi", "Group", "Student Group"]),
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
      const savedStudents = (data || []).map(normalizeStudent);
      const enrollmentRows = savedStudents
        .map((savedStudent, index) =>
          enrollmentToRow(
            buildEnrollmentFromStudent(
              { ...importedStudents[index], group: importedStudents[index]?.group || currentMonthInput() },
              savedStudent.id
            )
          )
        )
        .filter((row) => row.course_name);
      const savedEnrollmentsResult = enrollmentRows.length
        ? await supabase.from("enrollments").insert(enrollmentRows).select("*")
        : { data: [], error: null };
      if (savedEnrollmentsResult.error) throw savedEnrollmentsResult.error;
      setStudents((prev) => [...prev, ...savedStudents]);
      setEnrollments((prev) => [...prev, ...(savedEnrollmentsResult.data || []).map(normalizeEnrollment)]);
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
      email: normalizeEmail(teacherForm.email),
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
      pricingType: courseForm.pricingType,
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
    setEditingCoursePricingType(course.pricingType || "fixed");
  };

  const saveEditCourse = async () => {
    if (!editingCourseName.trim() || !editingCoursePrice) return;
    const nextCourse = {
      name: editingCourseName.trim(),
      price: parseFloat(editingCoursePrice),
      pricingType: editingCoursePricingType,
    };
    try {
      const savedCourse = await updateRow("courses", editingCourseId, courseToRow(nextCourse), normalizeCourse);
      setCourses((prev) => prev.map((course) => (course.id === editingCourseId ? savedCourse || { ...course, ...nextCourse } : course)));
      setEditingCourseId(null);
      setEditingCourseName("");
      setEditingCoursePrice("");
      setEditingCoursePricingType("fixed");
    } catch (error) {
      reportDataError(error);
    }
  };

  const openPaymentModal = () => {
    setPaymentModalTitle("Shto pagesë");
    setSelectedStudent("");
    setSelectedPaymentEnrollmentId("");
    setPaymentAmount("");
    setPaymentHours("");
    setPaymentRate("");
    setPaymentNote("");
    setPaymentDate(currentDateInput());
    setPaymentTeacherPercent(80);
    setPaymentAdminPercent(15);
    setPaymentSchoolPercent(5);
    setIsPaymentModalOpen(true);
  };

  const setPaymentDefaultsForStudent = (studentId, enrollmentId = "") => {
    setSelectedStudent(studentId);
    const student = studentsWithEnrollment.find((s) => sameId(s.id, studentId));
    const enrollmentOptions = paymentEnrollmentOptionsForStudent(studentId);
    const selectedEnrollment =
      enrollmentOptions.find((enrollment) => sameId(enrollment.id, enrollmentId)) ||
      enrollmentOptions.find((enrollment) => enrollment.status === "active") ||
      enrollmentOptions[0] ||
      null;
    setSelectedPaymentEnrollmentId(selectedEnrollment?.id || "");
    const course = selectedEnrollment
      ? getStudentCourse({ course: selectedEnrollment.course, courseId: selectedEnrollment.courseId })
      : student
        ? getStudentCourse(student)
        : null;
    const price = Number(course?.price || 0);
    if (isHourlyCourse(course)) {
      setPaymentHours("");
      setPaymentRate(price ? String(price) : "10");
      setPaymentAmount("");
      return;
    }
    setPaymentHours("");
    setPaymentRate("");
    setPaymentAmount(price ? formatExportCurrency(price) : "");
  };

  const openPaymentModalForStudent = (student) => {
    openPaymentModal();
    setPaymentModalTitle(`Pagesa - ${student.name || "Nxënësi"}`);
    setPaymentDefaultsForStudent(student.id);
  };

  const changePaymentStudent = (studentId) => {
    setPaymentDefaultsForStudent(studentId);
  };

  const changePaymentEnrollment = (enrollmentId) => {
    setPaymentDefaultsForStudent(selectedStudent, enrollmentId);
  };

  const changePaymentHours = (hours) => {
    setPaymentHours(hours);
    const amount = hourlyPaymentAmount(hours, paymentRate);
    setPaymentAmount(amount ? formatExportCurrency(amount) : "");
  };

  const changePaymentRate = (rate) => {
    setPaymentRate(rate);
    const amount = hourlyPaymentAmount(paymentHours, rate);
    setPaymentAmount(amount ? formatExportCurrency(amount) : "");
  };

  const addPayment = async () => {
    if (!paymentAmount || !selectedStudent) return;
    const student = studentsWithEnrollment.find((s) => sameId(s.id, selectedStudent));
    const enrollment =
      paymentEnrollmentOptionsForStudent(selectedStudent).find((item) => sameId(item.id, selectedPaymentEnrollmentId)) ||
      activeEnrollmentForStudent(student || { id: selectedStudent });
    const teacher = teachers.find((t) => sameId(t.id, enrollment?.teacherId ?? student?.teacherId));
    const course = enrollment
      ? getStudentCourse({ course: enrollment.course, courseId: enrollment.courseId })
      : student
        ? getStudentCourse(student)
        : null;
    const isHourly = isHourlyCourse(course);
    const nextPayment = 
      {
        studentId: selectedStudent,
        studentName: student?.name || "Pa student",
        enrollmentId: enrollment?.id || student?.enrollmentId || "",
        courseId: enrollment?.courseId || student?.courseId || "",
        courseName: enrollment?.course || student?.course || "",
        groupName: enrollment?.studentGroup || student?.studentGroup || "",
        paymentMonth: paymentDate ? monthFromDate(paymentDate) : currentPaymentMonth,
        teacherId: enrollment?.teacherId ?? student?.teacherId ?? null,
        teacherName: teacher?.name || "Pa mësues",
        amount: parseMoney(paymentAmount),
        teacherPercent: Number(paymentTeacherPercent),
        adminPercent: Number(paymentAdminPercent),
        schoolPercent: Number(paymentSchoolPercent),
        paymentType: isHourly ? "hourly" : "fixed",
        hours: isHourly ? paymentHours : "",
        rate: isHourly ? parseMoney(paymentRate) : "",
        note: paymentNote.trim(),
        date: paymentDate ? `${paymentDate}T00:00:00.000Z` : new Date().toISOString(),
      };
    try {
      const savedPayment = await insertRow("payments", paymentToRow(nextPayment), normalizePayment);
      setPayments((prev) => [...prev, savedPayment]);
      setPaymentAmount("");
      setPaymentHours("");
      setPaymentRate("");
      setPaymentNote("");
      setSelectedStudent("");
      setSelectedPaymentEnrollmentId("");
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

  const archiveExpense = async (expense) => {
    try {
      await archiveRow("expenses", expense.id);
      setArchive((prev) => ({ ...prev, expenses: [...(prev.expenses || []), { ...expense, archivedAt: new Date().toISOString() }] }));
      setExpenses((prev) => prev.filter((item) => item.id !== expense.id));
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

  const restoreExpense = async (expense) => {
    try {
      await restoreRow("expenses", expense.id);
      setExpenses((prev) => [...prev, { ...expense, archivedAt: null }]);
      setArchive((prev) => ({ ...prev, expenses: (prev.expenses || []).filter((x) => x.id !== expense.id) }));
    } catch (error) {
      reportDataError(error);
    }
  };

  const resetEnrollmentForm = (student = null) => {
    setEditingEnrollmentId(null);
    setEnrollmentForm({
      ...emptyEnrollmentForm,
      course: student?.course || "",
      group: currentMonthInput(),
      studentGroup: student?.studentGroup || "",
      teacherId: student?.teacherId || "",
      status: "active",
    });
  };

  const openEnrollmentModal = (student) => {
    setEnrollmentStudentId(student.id);
    resetEnrollmentForm(student);
    setIsEnrollmentModalOpen(true);
  };

  const startEditEnrollment = (enrollment) => {
    setEditingEnrollmentId(enrollment.id);
    setEnrollmentForm({
      course: enrollment.course || "",
      group: enrollment.group || "",
      studentGroup: enrollment.studentGroup || "",
      teacherId: enrollment.teacherId || "",
      status: enrollment.status || "active",
      endMonth: enrollment.endMonth || "",
      note: enrollment.note || "",
    });
  };

  const closeOtherActiveEnrollments = async (studentId, exceptEnrollmentId = null, endMonth = currentMonthInput()) => {
    void studentId;
    void exceptEnrollmentId;
    void endMonth;
  };

  const saveEnrollmentForm = async () => {
    if (!enrollmentStudentId || !enrollmentForm.course) return;
    const nextEnrollment = {
      studentId: enrollmentStudentId,
      course: enrollmentForm.course,
      group: enrollmentForm.group || currentMonthInput(),
      studentGroup: enrollmentForm.studentGroup.trim(),
      teacherId: enrollmentForm.teacherId || null,
      status: enrollmentForm.status || "active",
      endMonth: enrollmentForm.status === "active" ? "" : enrollmentForm.endMonth,
      note: enrollmentForm.note.trim(),
    };

    try {
      if (nextEnrollment.status === "active") {
        await closeOtherActiveEnrollments(enrollmentStudentId, editingEnrollmentId, nextEnrollment.group);
      }
      const savedEnrollment = await saveEnrollment(nextEnrollment, editingEnrollmentId);
      if (savedEnrollment.status === "active") {
        await updateStudentMirrorFromEnrollment(enrollmentStudentId, savedEnrollment);
      }
      const selectedStudent = studentsWithEnrollment.find((student) => sameId(student.id, enrollmentStudentId));
      resetEnrollmentForm(selectedStudent);
    } catch (error) {
      reportDataError(error);
    }
  };

  const updateEnrollmentStatus = async (enrollment, status) => {
    const nextEnrollment = {
      ...enrollment,
      status,
      endMonth: status === "active" ? "" : enrollment.endMonth || currentMonthInput(),
    };

    try {
      if (status === "active") {
        await closeOtherActiveEnrollments(enrollment.studentId, enrollment.id, enrollment.group || currentMonthInput());
      }
      const savedEnrollment = await saveEnrollment(nextEnrollment, enrollment.id);
      if (savedEnrollment.status === "active") {
        await updateStudentMirrorFromEnrollment(enrollment.studentId, savedEnrollment);
      }
    } catch (error) {
      reportDataError(error);
    }
  };

  const deleteEnrollment = async (enrollment) => {
    if (!window.confirm("A je i sigurt qe don me e fshi kete kurs te ky nxenes?")) return;

    const remainingEnrollment =
      studentEnrollmentRows(enrollment.studentId).filter((item) => !sameId(item.id, enrollment.id))[0] || null;

    try {
      await deleteRow("enrollments", enrollment.id);
      setEnrollments((prev) => prev.filter((item) => !sameId(item.id, enrollment.id)));

      if (remainingEnrollment) {
        await updateStudentMirrorFromEnrollment(enrollment.studentId, remainingEnrollment);
      } else {
        const student = students.find((item) => sameId(item.id, enrollment.studentId));
        if (student) {
          const clearedStudent = {
            ...student,
            course: "",
            group: "",
            studentGroup: "",
            teacherId: null,
          };
          const savedStudent = await updateRow("students", enrollment.studentId, studentToRow(clearedStudent), normalizeStudent);
          setStudents((prev) =>
            prev.map((item) => (sameId(item.id, enrollment.studentId) ? savedStudent || clearedStudent : item))
          );
        }
      }

      if (sameId(editingEnrollmentId, enrollment.id)) {
        setEditingEnrollmentId(null);
        setEnrollmentForm({ ...emptyEnrollmentForm, group: currentMonthInput() });
      }
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
    setEditingStudentStudentGroup(student.studentGroup || "");
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
    setEditingStudentStudentGroup("");
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
      studentGroup: editingStudentStudentGroup.trim(),
      teacherId: editingStudentTeacherId || null,
    };
    try {
      const savedStudent = await updateRow("students", editingStudentId, studentToRow(nextStudent), normalizeStudent);
      await saveActiveEnrollmentForStudent(editingStudentId, nextStudent);
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
    setEditingTeacherEmail(teacher.email || "");
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
      email: normalizeEmail(editingTeacherEmail),
      percent: Number(editingTeacherPercent),
    };
    try {
      const savedTeacher = await updateRow("teachers", editingTeacherId, teacherToRow(nextTeacher), normalizeTeacher);
      setTeachers((prev) => prev.map((teacher) => (teacher.id === editingTeacherId ? savedTeacher || { ...teacher, ...nextTeacher } : teacher)));
      setEditingTeacherId(null);
      setEditingTeacherFirstName("");
      setEditingTeacherLastName("");
      setEditingTeacherEmail("");
      setEditingTeacherPercent(80);
    } catch (error) {
      reportDataError(error);
    }
  };

  const openAssignStudentsModal = () => {
    const initialTeacherId = selectedTeacherView || sortedTeachersAlpha[0]?.id || "";
    setAssignTeacherId(initialTeacherId ? String(initialTeacherId) : "");
    setAssignStudentIds(
      initialTeacherId
        ? studentsWithEnrollment.filter((student) => sameId(student.teacherId, initialTeacherId)).map((student) => student.id)
        : []
    );
    setIsAssignStudentsModalOpen(true);
  };

  const changeAssignTeacher = (teacherId) => {
    setAssignTeacherId(teacherId);
    setAssignStudentIds(
      teacherId
        ? studentsWithEnrollment.filter((student) => sameId(student.teacherId, teacherId)).map((student) => student.id)
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
        const currentStudent = studentsWithEnrollment.find((item) => sameId(item.id, student.id)) || student;
        const isSelected = assignStudentIds.some((id) => sameId(id, student.id));
        const belongsToTeacher = sameId(currentStudent.teacherId, assignTeacherId);

        if (isSelected) {
          return { ...student, teacherId: assignTeacherId };
        }

        if (belongsToTeacher) {
          return { ...student, teacherId: null };
        }

        return student;
      });
    const changedStudents = nextStudents.filter((student) => {
      const previousStudent = studentsWithEnrollment.find((item) => sameId(item.id, student.id));
      return String(previousStudent?.teacherId || "") !== String(student.teacherId || "");
    });

    try {
      const results = await Promise.all([
        ...changedStudents.map((student) =>
          supabase.from("students").update({ teacher_id: student.teacherId || null }).eq("id", student.id)
        ),
        ...changedStudents.map((student) => {
          const currentStudent = studentsWithEnrollment.find((item) => sameId(item.id, student.id)) || student;
          const existingEnrollment = currentActiveEnrollmentForStudent(student.id) || studentEnrollmentRows(student.id)[0];
          const nextEnrollment = buildEnrollmentFromStudent(
            { ...currentStudent, teacherId: student.teacherId || null },
            student.id,
            {
              status: existingEnrollment?.status || "active",
              endMonth: existingEnrollment?.endMonth || "",
              note: existingEnrollment?.note || "",
            }
          );
          return existingEnrollment
            ? supabase.from("enrollments").update(enrollmentToRow(nextEnrollment)).eq("id", existingEnrollment.id).select("*").maybeSingle()
            : supabase.from("enrollments").insert(enrollmentToRow(nextEnrollment)).select("*").single();
        }),
      ]);
      const firstError = results.find((result) => result.error)?.error;
      if (firstError) throw firstError;
      const savedEnrollments = results
        .map((result) => result.data)
        .filter((row) => row?.student_id)
        .map(normalizeEnrollment);
      setStudents(nextStudents);
      setEnrollments((prev) => savedEnrollments.reduce((rows, enrollment) => upsertById(rows, enrollment), prev));
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
    setEditingPaymentEnrollmentId(String(payment.enrollmentId || ""));
    setEditingPaymentDate(payment.date ? String(payment.date).slice(0, 10) : "");
    setEditingPaymentNote(payment.note || "");
    setEditingPaymentHours(payment.hours == null ? "" : String(payment.hours));
    setEditingPaymentRate(payment.rate == null ? "" : String(payment.rate));
    setEditingPaymentType(payment.paymentType || "fixed");
  };

  const saveEditPayment = async () => {
    if (!editingPaymentAmount || !editingPaymentStudentId || !editingPaymentDate) return;
    const student = studentsWithEnrollment.find((s) => sameId(s.id, editingPaymentStudentId));
    const enrollment =
      paymentEnrollmentOptionsForStudent(editingPaymentStudentId).find((item) => sameId(item.id, editingPaymentEnrollmentId)) ||
      activeEnrollmentForStudent(student || { id: editingPaymentStudentId });
    const teacher = teachers.find((t) => sameId(t.id, enrollment?.teacherId ?? student?.teacherId));
    const existingPayment = payments.find((payment) => payment.id === editingPaymentId);
    const course = enrollment
      ? getStudentCourse({ course: enrollment.course, courseId: enrollment.courseId })
      : student
        ? getStudentCourse(student)
        : null;
    const isHourly = editingPaymentType === "hourly" || isHourlyCourse(course);
    const nextPayment = 
      {
        amount: parseMoney(editingPaymentAmount),
        studentId: editingPaymentStudentId,
        studentName: student?.name || existingPayment?.studentName || "Pa student",
        enrollmentId: enrollment?.id || existingPayment?.enrollmentId || "",
        courseId: enrollment?.courseId || existingPayment?.courseId || "",
        courseName: enrollment?.course || existingPayment?.courseName || "",
        groupName: enrollment?.studentGroup || existingPayment?.groupName || "",
        paymentMonth: monthFromDate(editingPaymentDate),
        teacherId: enrollment?.teacherId ?? student?.teacherId ?? null,
        teacherName: teacher?.name || existingPayment?.teacherName || "Pa mësues",
        teacherPercent: existingPayment?.teacherPercent ?? 80,
        adminPercent: existingPayment?.adminPercent ?? 15,
        schoolPercent: existingPayment?.schoolPercent ?? 5,
        paymentType: editingPaymentType,
        hours: isHourly ? editingPaymentHours : "",
        rate: isHourly ? parseMoney(editingPaymentRate) : "",
        note: editingPaymentNote.trim(),
        date: `${editingPaymentDate}T00:00:00.000Z`,
      };
    try {
      const savedPayment = await updateRow("payments", editingPaymentId, paymentToRow(nextPayment), normalizePayment);
      setPayments((prev) => prev.map((payment) => (payment.id === editingPaymentId ? savedPayment || { ...payment, ...nextPayment } : payment)));
      setEditingPaymentId(null);
      setEditingPaymentAmount("");
      setEditingPaymentStudentId("");
      setEditingPaymentEnrollmentId("");
      setEditingPaymentDate("");
      setEditingPaymentNote("");
      setEditingPaymentHours("");
      setEditingPaymentRate("");
      setEditingPaymentType("fixed");
    } catch (error) {
      reportDataError(error);
    }
  };

  const changeEditingPaymentHours = (hours) => {
    setEditingPaymentHours(hours);
    const amount = hourlyPaymentAmount(hours, editingPaymentRate);
    setEditingPaymentAmount(amount ? String(amount) : "");
  };

  const changeEditingPaymentRate = (rate) => {
    setEditingPaymentRate(rate);
    const amount = hourlyPaymentAmount(editingPaymentHours, rate);
    setEditingPaymentAmount(amount ? String(amount) : "");
  };

  const changeEditingPaymentStudent = (studentId) => {
    setEditingPaymentStudentId(studentId);
    const student = studentsWithEnrollment.find((s) => sameId(s.id, studentId));
    const enrollmentOptions = paymentEnrollmentOptionsForStudent(studentId);
    const selectedEnrollment = enrollmentOptions.find((enrollment) => enrollment.status === "active") || enrollmentOptions[0] || null;
    setEditingPaymentEnrollmentId(selectedEnrollment?.id || "");
    const course = selectedEnrollment
      ? getStudentCourse({ course: selectedEnrollment.course, courseId: selectedEnrollment.courseId })
      : student
        ? getStudentCourse(student)
        : null;
    const price = Number(course?.price || 0);
    if (isHourlyCourse(course)) {
      setEditingPaymentType("hourly");
      setEditingPaymentHours("");
      setEditingPaymentRate(price ? String(price) : "10");
      setEditingPaymentAmount("");
      return;
    }
    setEditingPaymentType("fixed");
    setEditingPaymentHours("");
    setEditingPaymentRate("");
    setEditingPaymentAmount(price ? String(price) : "");
  };

  const changeEditingPaymentEnrollment = (enrollmentId) => {
    setEditingPaymentEnrollmentId(enrollmentId);
    const selectedEnrollment =
      paymentEnrollmentOptionsForStudent(editingPaymentStudentId).find((enrollment) => sameId(enrollment.id, enrollmentId)) || null;
    const course = selectedEnrollment
      ? getStudentCourse({ course: selectedEnrollment.course, courseId: selectedEnrollment.courseId })
      : null;
    const price = Number(course?.price || 0);
    if (isHourlyCourse(course)) {
      setEditingPaymentType("hourly");
      setEditingPaymentHours("");
      setEditingPaymentRate(price ? String(price) : "10");
      setEditingPaymentAmount("");
      return;
    }
    setEditingPaymentType("fixed");
    setEditingPaymentHours("");
    setEditingPaymentRate("");
    setEditingPaymentAmount(price ? String(price) : "");
  };

  const currentPaymentMonth = monthFromDate(new Date().toISOString());

  const getStudentCourse = (student) => courses.find((course) => sameId(course.id, student.courseId) || course.name === student.course);
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
  const paymentEnrollment = useCallback(
    (payment) => enrollments.find((enrollment) => sameId(enrollment.id, payment.enrollmentId)),
    [enrollments]
  );
  const paymentStudent = useCallback(
    (payment) => studentsWithEnrollment.find((student) => sameId(student.id, payment.studentId)),
    [studentsWithEnrollment]
  );
  const paymentTeacherId = useCallback(
    (payment) => payment.teacherId ?? paymentEnrollment(payment)?.teacherId ?? paymentStudent(payment)?.teacherId ?? null,
    [paymentEnrollment, paymentStudent]
  );
  const paymentTeacher = useCallback(
    (payment) => teachers.find((teacher) => sameId(teacher.id, paymentTeacherId(payment))),
    [paymentTeacherId, teachers]
  );
  const adjustedTeacherPaymentRows = useCallback(
    (teacher, teacherPayments) => {
      const paymentsByMonth = teacherPayments.reduce((groups, payment) => {
        const monthKey = monthFromDate(payment.date) || "";
        if (!groups[monthKey]) groups[monthKey] = [];
        groups[monthKey].push(payment);
        return groups;
      }, {});

      return Object.entries(paymentsByMonth).flatMap(([monthKey, monthPayments]) => {
        const baseRows = monthPayments.map((payment) => {
          const total = Number(payment.amount || 0);
          const teacherBaseShare = total * (paymentTeacherPercentValue(payment, teacher) / 100);
          const adminShare = total * (paymentAdminPercentValue(payment) / 100);
          const rawSchoolShare = total * (paymentSchoolPercentValue(payment) / 100);
          return {
            payment,
            monthKey,
            total,
            teacherBaseShare,
            adminShare,
            rawSchoolShare,
          };
        });
        const rawSchoolTotal = baseRows.reduce((sum, row) => sum + row.rawSchoolShare, 0);
        const capApplies = monthKey >= SCHOOL_SHARE_CAP_START_MONTH;
        const schoolMultiplier =
          capApplies && rawSchoolTotal > SCHOOL_SHARE_CAP_AMOUNT
            ? SCHOOL_SHARE_CAP_AMOUNT / rawSchoolTotal
            : 1;

        return baseRows.map((row) => {
          const schoolShare = row.rawSchoolShare * schoolMultiplier;
          const teacherShare = row.teacherBaseShare + (row.rawSchoolShare - schoolShare);
          return {
            ...row,
            teacherShare,
            schoolShare,
          };
        });
      });
    },
    []
  );
  const summarizeTeacherPayments = useCallback(
    (teacher, teacherPayments) => {
      const rows = adjustedTeacherPaymentRows(teacher, teacherPayments);
      return rows.reduce(
        (summary, row) => ({
          total: summary.total + row.total,
          teacherShare: summary.teacherShare + row.teacherShare,
          adminShare: summary.adminShare + row.adminShare,
          schoolShare: summary.schoolShare + row.schoolShare,
        }),
        { total: 0, teacherShare: 0, adminShare: 0, schoolShare: 0 }
      );
    },
    [adjustedTeacherPaymentRows]
  );

  const filteredStudents = studentsWithEnrollment.filter((student) => {
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
      student.studentGroup,
      enrollmentStatusLabel(student.enrollmentStatus),
      teacher?.name,
    ].some((value) => String(value || "").toLowerCase().includes(q));
  });
  const filteredStudentsByGroup = filteredStudents.filter((student) => {
    const matchesGroup = studentGroupFilter ? student.group === studentGroupFilter : true;
    const matchesStatus = studentStatusFilter ? student.enrollmentStatus === studentStatusFilter : true;
    return matchesGroup && matchesStatus;
  });

  const selectedTeacherStudents = studentsWithEnrollment.filter((student) => {
    const matchesTeacher = sameId(student.teacherId, selectedTeacherView);
    const matchesMonth = teacherMonthFilter ? student.group === teacherMonthFilter : true;
    return matchesTeacher && matchesMonth;
  });
  const sortedSelectedTeacherStudents = sortRows(selectedTeacherStudents, "selectedTeacherStudents", {
    nr: (_student, index) => index + 1,
    name: (student) => student.firstName || student.name,
    lastName: (student) => student.lastName,
    course: (student) => student.course,
    group: (student) => student.group,
    studentGroup: (student) => student.studentGroup,
  });

  const activePaymentTeacherFilter = paymentTeacherFilter && teachers.some((t) => t.name === paymentTeacherFilter) ? paymentTeacherFilter : "";
  const activeFinanceTeacherFilter = financeTeacherFilter && teachers.some((t) => t.name === financeTeacherFilter) ? financeTeacherFilter : "";
  const paymentsForCurrentUser = useMemo(() => {
    if (!isTeacherUser) return payments;
    return payments.filter((payment) => sameId(paymentTeacherId(payment), currentTeacherId));
  }, [currentTeacherId, isTeacherUser, payments, paymentTeacherId]);

  const enrichedPayments = paymentsForCurrentUser.map((payment) => {
    const student = paymentStudent(payment);
    const enrollment = paymentEnrollment(payment);
    const teacher = paymentTeacher(payment);
    return {
      ...payment,
      studentName: payment.studentName || student?.name || "Pa student",
      teacherName: payment.teacherName || teacher?.name || "Pa mësues",
      courseName: payment.courseName || enrollment?.course || student?.course || "",
      groupName: payment.groupName || enrollment?.studentGroup || student?.studentGroup || "",
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
        String(payment.hours || "").includes(q) ||
        String(payment.rate || "").includes(q) ||
        String(payment.note || "").toLowerCase().includes(q) ||
        payment.month.includes(q) ||
        formatDateDisplay(payment.date).includes(q);

    const matchesTeacher = !activePaymentTeacherFilter ? true : payment.teacherName === activePaymentTeacherFilter;
    const matchesMonth = paymentMonthFilter ? monthFromDate(payment.date) === paymentMonthFilter : true;
    return matchesSearch && matchesTeacher && matchesMonth;
  });

  const filteredExpenses = expenses.filter((expense) => {
    const matchesMonth = !financeOverviewMonth ? true : monthFromDate(expense.date) === financeOverviewMonth;
    return matchesMonth;
  });

  const filteredCourses = courses.filter((course) => {
    const q = courseSearch.trim().toLowerCase();
    return !q || course.name.toLowerCase().includes(q) || String(course.price).includes(q) || pricingTypeLabel(course.pricingType).toLowerCase().includes(q);
  });

  const teacherEarnings = useMemo(() => {
    return teachers
      .filter((teacher) => (isTeacherUser ? sameId(teacher.id, currentTeacherId) : !activeFinanceTeacherFilter || teacher.name === activeFinanceTeacherFilter))
      .map((teacher) => {
        const teacherStudents = studentsWithEnrollment.filter((student) => sameId(student.teacherId, teacher.id));
        const relevantPayments = paymentsForCurrentUser.filter((payment) => {
          const sameTeacher = sameId(paymentTeacherId(payment), teacher.id);
          const sameMonth = financeMonth ? monthFromDate(payment.date) === financeMonth : true;
          return sameTeacher && sameMonth;
        });
        const notes = [...new Set(relevantPayments.map((payment) => payment.note).filter(Boolean))].join("; ");
        const summary = summarizeTeacherPayments(teacher, relevantPayments);
        const { total, teacherShare, adminShare, schoolShare } = summary;
        const remainingShare = total - teacherShare - adminShare - schoolShare;

        return {
          ...teacher,
          studentsCount: teacherStudents.length,
          total,
          teacherShare,
          adminShare,
          schoolShare,
          remainingShare,
          notes,
        };
      });
  }, [teachers, studentsWithEnrollment, paymentsForCurrentUser, financeMonth, activeFinanceTeacherFilter, isTeacherUser, currentTeacherId, paymentTeacherId, summarizeTeacherPayments]);

  const allTimeIncomeOverview = useMemo(() => {
    const totalIncome = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const totalAdminShare = payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0) * (paymentAdminPercentValue(payment) / 100),
      0
    );
    const teacherRows = teachers.map((teacher) => {
      const teacherPayments = payments.filter((payment) => sameId(paymentTeacherId(payment), teacher.id));
      const total = summarizeTeacherPayments(teacher, teacherPayments).teacherShare;
      return {
        id: teacher.id,
        name: teacher.name,
        total,
      };
    });
    const totalSchoolShare = teachers.reduce((sum, teacher) => {
      const teacherPayments = payments.filter((payment) => sameId(paymentTeacherId(payment), teacher.id));
      return sum + summarizeTeacherPayments(teacher, teacherPayments).schoolShare;
    }, 0);

    return {
      totalIncome,
      totalAdminShare,
      totalSchoolShare,
      teacherRows,
    };
  }, [payments, teachers, paymentTeacherId, summarizeTeacherPayments]);

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
      formatMonthYear(student.group),
      student.studentGroup,
    ].some((value) => String(value || "").toLowerCase().includes(q));
  });

  const filteredArchiveTeachers = archive.teachers.filter((teacher) => {
    const q = archiveSearch.trim().toLowerCase();
    return !q || teacher.name.toLowerCase().includes(q) || (teacher.email || "").toLowerCase().includes(q);
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
    return !q || course.name.toLowerCase().includes(q) || String(course.price).includes(q) || pricingTypeLabel(course.pricingType).toLowerCase().includes(q);
  });

  const filteredArchiveExpenses = (archive.expenses || []).filter((expense) => {
    const q = archiveSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (expense.name || "").toLowerCase().includes(q) ||
      String(expense.amount).includes(q) ||
      String(expense.note || "").toLowerCase().includes(q) ||
      monthFromDate(expense.date).includes(q) ||
      formatDateDisplay(expense.date).includes(q)
    );
  });

  const sortedStudents = sortRows(filteredStudentsByGroup, "students", {
    nr: (_student, index) => index + 1,
    firstName: (student) => student.firstName || student.name,
    lastName: (student) => student.lastName,
    age: (student) => student.age,
    city: (student) => student.city,
    course: (student) => student.course,
    group: (student) => student.group,
    studentGroup: (student) => student.studentGroup,
    status: (student) => enrollmentStatusLabel(student.enrollmentStatus),
    teacherName: (student) => student.teacherName || teachers.find((teacher) => sameId(teacher.id, student.teacherId))?.name || "Pa mesues",
    payment: (student) => (hasStudentCurrentPayment(student) ? 1 : 0),
  });

  const teacherStudentsForMonth = (teacherId) =>
    studentsWithEnrollment.filter(
      (student) => sameId(student.teacherId, teacherId) && (!teacherMonthFilter || student.group === teacherMonthFilter)
    );

  const filteredTeachers = teachers.filter((teacher) => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return true;
    const teacherStudents = teacherStudentsForMonth(teacher.id);
    return (
      teacher.name.toLowerCase().includes(q) ||
      (teacher.firstName || "").toLowerCase().includes(q) ||
      (teacher.lastName || "").toLowerCase().includes(q) ||
      (teacher.email || "").toLowerCase().includes(q) ||
      String(teacher.percent).includes(q) ||
      String(teacherStudents.length).includes(q)
    );
  });

  const sortedTeachers = sortRows(filteredTeachers, "teachers", {
    nr: (_teacher, index) => index + 1,
    name: (teacher) => teacher.firstName || teacher.name,
    lastName: (teacher) => teacher.lastName,
    email: (teacher) => teacher.email,
    studentsCount: (teacher) => teacherStudentsForMonth(teacher.id).length,
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

  const selectedPagaTeacher = teachers.find((teacher) => sameId(teacher.id, selectedPagaTeacherView));
  const selectedPagaPaidStudents = useMemo(() => {
    if (!selectedPagaTeacherView) return [];

    const rowsByStudent = new Map();
    payments.forEach((payment) => {
      const student = paymentStudent(payment);
      const enrollment = paymentEnrollment(payment);
      if (!sameId(paymentTeacherId(payment), selectedPagaTeacherView)) return;
      if (financeMonth && monthFromDate(payment.date) !== financeMonth) return;

      const key = payment.studentId || payment.studentName || payment.id;
      const existingRow = rowsByStudent.get(key);
      const nameParts = String(payment.studentName || student?.name || "").split(" ").filter(Boolean);
      rowsByStudent.set(key, {
        id: key,
        firstName: student?.firstName || nameParts[0] || payment.studentName || "Pa student",
        lastName: student?.lastName || nameParts.slice(1).join(" "),
        course: payment.courseName || enrollment?.course || student?.course || "-",
        amount: Number(existingRow?.amount || 0) + Number(payment.amount || 0),
      });
    });

    return Array.from(rowsByStudent.values()).sort((a, b) => {
      const firstNameSort = a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" });
      return firstNameSort || a.lastName.localeCompare(b.lastName, undefined, { sensitivity: "base" });
    });
  }, [financeMonth, payments, selectedPagaTeacherView, paymentStudent, paymentEnrollment, paymentTeacherId]);

  const financePaymentRows = teachers
    .filter((teacher) => (isTeacherUser ? sameId(teacher.id, currentTeacherId) : !activeFinanceTeacherFilter || teacher.name === activeFinanceTeacherFilter))
    .flatMap((teacher) => {
      const teacherPayments = paymentsForCurrentUser.filter((payment) => {
        const matchesTeacher = sameId(paymentTeacherId(payment), teacher.id);
        const matchesMonth = financeMonth ? monthFromDate(payment.date) === financeMonth : true;
        return matchesTeacher && matchesMonth;
      });
      return adjustedTeacherPaymentRows(teacher, teacherPayments).map((row) => {
        const student = paymentStudent(row.payment);
        return {
          teacherName: teacher.name,
          studentName: row.payment.studentName || student?.name || "Pa student",
          teacherPayment: row.teacherShare,
        };
      });
    })
    .sort((a, b) => {
      const teacherSort = a.teacherName.localeCompare(b.teacherName, undefined, { sensitivity: "base" });
      return teacherSort || a.studentName.localeCompare(b.studentName, undefined, { sensitivity: "base" });
    });

  const financeExportTotal = financePaymentRows.reduce((sum, row) => sum + row.teacherPayment, 0);
  const financeExportTeacherName = isTeacherUser ? currentTeacherAccount?.name || "" : activeFinanceTeacherFilter;
  const overviewPayments = payments.filter((payment) => (financeOverviewMonth ? monthFromDate(payment.date) === financeOverviewMonth : true));
  const overviewIncome = overviewPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const overviewTeacherPay = teachers.reduce((sum, teacher) => {
    const teacherPayments = overviewPayments.filter((payment) => sameId(paymentTeacherId(payment), teacher.id));
    return sum + summarizeTeacherPayments(teacher, teacherPayments).teacherShare;
  }, 0);
  const overviewAdminShare = overviewPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0) * (paymentAdminPercentValue(payment) / 100),
    0
  );
  const overviewSchoolShare = teachers.reduce((sum, teacher) => {
    const teacherPayments = overviewPayments.filter((payment) => sameId(paymentTeacherId(payment), teacher.id));
    return sum + summarizeTeacherPayments(teacher, teacherPayments).schoolShare;
  }, 0);
  const overviewExpenses = expenses
    .filter((expense) => monthFromDate(expense.date) === financeOverviewMonth)
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const carriedPayments = payments.filter((payment) => monthIsOnOrBefore(payment.date, financeOverviewMonth));
  const carriedSchoolShare = teachers.reduce((sum, teacher) => {
    const teacherPayments = carriedPayments.filter((payment) => sameId(paymentTeacherId(payment), teacher.id));
    return sum + summarizeTeacherPayments(teacher, teacherPayments).schoolShare;
  }, 0);
  const carriedExpenses = expenses
    .filter((expense) => monthIsOnOrBefore(expense.date, financeOverviewMonth))
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const overviewProfit = carriedSchoolShare - carriedExpenses;

  const sortedExpenses = sortRows(filteredExpenses, "finance", {
    nr: (_expense, index) => index + 1,
    name: (expense) => expense.name,
    date: (expense) => new Date(expense.date).getTime(),
    amount: (expense) => expense.amount,
  });

  const sortedCourses = sortRows(filteredCourses, "courses", {
    nr: (_course, index) => index + 1,
    name: (course) => course.name,
    pricingType: (course) => pricingTypeLabel(course.pricingType),
    price: (course) => course.price,
  });

  const sortedArchiveCourses = sortRows(filteredArchiveCourses, "courses", {
    nr: (_course, index) => index + 1,
    name: (course) => course.name,
    pricingType: (course) => pricingTypeLabel(course.pricingType),
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

  const sortedArchiveExpenses = sortRows(filteredArchiveExpenses, "archiveExpenses", {
    nr: (_expense, index) => index + 1,
    name: (expense) => expense.name,
    date: (expense) => new Date(expense.date).getTime(),
    amount: (expense) => expense.amount,
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

      if (type === "expenses") {
        const items = (archive.expenses || []).filter((item) => ids.includes(item.id)).map((item) => ({ ...item, archivedAt: null }));
        setExpenses((prev) => [...prev, ...items]);
        setArchive((prev) => ({ ...prev, expenses: (prev.expenses || []).filter((item) => !ids.includes(item.id)) }));
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
    ...(financeExportTeacherName
      ? [
          [financeExportTeacherName, "", ""],
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
        if (financeExportTeacherName && rowIndex === 0) {
          return `<tr><td colspan="2" class="first-row merged">${escapeHtml(row[0])}</td><td></td></tr>`;
        }

        const cellTag = rowIndex === 0 || (financeExportTeacherName && rowIndex === 1) ? "th" : "td";
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
    const suffix = financeExportTeacherName ? financeExportTeacherName.replace(/\s+/g, "_") : "te_gjithe";
    link.href = url;
    link.download = `financa_${suffix}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportFinancePdf = (note = "") => {
    const doc = new jsPDF({ orientation: "landscape" });
    const title = financeExportTeacherName ? `Financa - ${financeExportTeacherName}` : "Financa - Te gjithe mesuesit";
    doc.setFontSize(14);
    doc.text(title, 14, 15);

    if (financeExportTeacherName) {
      autoTable(doc, {
        startY: 22,
        theme: "grid",
        tableWidth: "auto",
        styles: { lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { fontStyle: "bold" },
        head: [
          [{ content: financeExportTeacherName, colSpan: 3, styles: { fontStyle: "bold", halign: "center" } }],
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

    const suffix = financeExportTeacherName ? financeExportTeacherName.replace(/\s+/g, "_") : "te_gjithe";
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
    const suffix = financeOverviewMonth || "te_gjitha";
    link.href = url;
    link.download = `shpenzime_${suffix}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportExpensesPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const title = financeOverviewMonth ? `Shpenzime - ${formatMonthYear(financeOverviewMonth)}` : "Shpenzime - Te gjitha";
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
    const suffix = financeOverviewMonth || "te_gjitha";
    doc.save(`shpenzime_${suffix}.pdf`);
  };

  const exportAllData = () => {
    const workbook = XLSX.utils.book_new();
    const teacherById = (id) => teachers.find((teacher) => sameId(teacher.id, id));
    const studentById = (id) => studentsWithEnrollment.find((student) => sameId(student.id, id));
    const allTimeTeacherRows = teachers.map((teacher, index) => {
      const teacherPayments = payments.filter((payment) => sameId(paymentTeacher(payment)?.id, teacher.id));
      const { total, teacherShare, adminShare, schoolShare } = summarizeTeacherPayments(teacher, teacherPayments);

      return [
        index + 1,
        teacher.firstName || teacher.name,
        teacher.lastName || "",
        teacher.email || "",
        `${teacher.percent}%`,
        studentsWithEnrollment.filter((student) => sameId(student.teacherId, teacher.id)).length,
        formatExportCurrency(total),
        formatExportCurrency(teacherShare),
        formatExportCurrency(adminShare),
        formatExportCurrency(schoolShare),
        formatExportCurrency(total - teacherShare - adminShare - schoolShare),
      ];
    });
    const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

    const sheets = [
      {
        name: "Nxenesit",
        rows: [
          ["Nr", "Emri", "Mbiemri", "Mosha", "Qyteti", "Telefoni", "Emaili", "Kursi", "Muaji", "Grupi", "Statusi", "Mesuesi", "Pagesa"],
          ...studentsWithEnrollment.map((student, index) => {
            const teacher = teacherById(student.teacherId);
            return [
              index + 1,
              student.firstName || student.name,
              student.lastName || "",
              student.age || "",
              student.city || "",
              student.phone || "",
              student.email || "",
              student.course || "",
              formatMonthYear(student.group),
              student.studentGroup || "",
              enrollmentStatusLabel(student.enrollmentStatus),
              teacher?.name || "Pa mesues",
              hasStudentCurrentPayment(student) ? "E paguar" : "Pa paguar",
            ];
          }),
        ],
      },
      {
        name: "Mesuesit",
        rows: [
          ["Nr", "Emri", "Mbiemri", "Email", "Perqindja", "Nxenes"],
          ...teachers.map((teacher, index) => [
            index + 1,
            teacher.firstName || teacher.name,
            teacher.lastName || "",
            teacher.email || "",
            `${teacher.percent}%`,
            studentsWithEnrollment.filter((student) => sameId(student.teacherId, teacher.id)).length,
          ]),
        ],
      },
      {
        name: "Regjistrimet",
        rows: [
          ["Nr", "Nxenesi", "Kursi", "Muaji", "Grupi", "Mesuesi", "Statusi", "Deri", "Shenime"],
          ...enrollments.map((enrollment, index) => {
            const student = studentById(enrollment.studentId);
            const teacher = teacherById(enrollment.teacherId);
            return [
              index + 1,
              student?.name || "Pa student",
              enrollment.course || "",
              formatMonthYear(enrollment.group),
              enrollment.studentGroup || "",
              teacher?.name || enrollment.teacherName || "Pa mesues",
              enrollmentStatusLabel(enrollment.status),
              formatMonthYear(enrollment.endMonth),
              enrollment.note || "",
            ];
          }),
        ],
      },
      {
        name: "Pagesat",
        rows: [
          ["Nr", "Nxenesi", "Mesuesi", "Shuma", "Orët", "Çmimi/orë", "Data", "Mesuesi %", "Administrata %", "Shkolla %", "Shenime"],
          ...payments.map((payment, index) => [
            index + 1,
            payment.studentName || studentById(payment.studentId)?.name || "Pa student",
            payment.teacherName || paymentTeacher(payment)?.name || "Pa mesues",
            formatExportCurrency(payment.amount),
            payment.paymentType === "hourly" ? payment.hours || "" : "",
            payment.paymentType === "hourly" ? formatExportCurrency(payment.rate) : "",
            formatDateDisplay(payment.date),
            `${paymentTeacherPercentValue(payment, paymentTeacher(payment))}%`,
            `${paymentAdminPercentValue(payment)}%`,
            `${paymentSchoolPercentValue(payment)}%`,
            payment.note || "",
          ]),
        ],
      },
      {
        name: "Paga",
        rows: [
          ["Nr", "Emri", "Mbiemri", "Email", "%", "Nxenes", "Total", "Mesuesi", "Administrata", "Shkolla", "Mbetja"],
          ...allTimeTeacherRows,
        ],
      },
      {
        name: "Financa",
        rows: [
          ["Kategoria", "Totali"],
          ["Te gjitha te hyrat", formatExportCurrency(allTimeIncomeOverview.totalIncome)],
          ["Paga mesuesve", formatExportCurrency(allTimeTeacherRows.reduce((sum, row) => sum + parseMoney(row[7]), 0))],
          ["Administrata", formatExportCurrency(allTimeIncomeOverview.totalAdminShare)],
          ["Shkolla", formatExportCurrency(allTimeIncomeOverview.totalSchoolShare)],
          ["Shpenzime", formatExportCurrency(totalExpenses)],
          ["Te mbetura", formatExportCurrency(allTimeIncomeOverview.totalSchoolShare - totalExpenses)],
          [],
          ["Nr", "Produkti / Shpenzimi", "Data", "Cmimi", "Shenime"],
          ...expenses.map((expense, index) => [
            index + 1,
            expense.name,
            formatDateDisplay(expense.date),
            formatExportCurrency(expense.amount),
            expense.note || "",
          ]),
        ],
      },
      {
        name: "Shpenzime",
        rows: [
          ["Nr", "Produkti / Shpenzimi", "Data", "Cmimi", "Shenime"],
          ...expenses.map((expense, index) => [
            index + 1,
            expense.name,
            formatDateDisplay(expense.date),
            formatExportCurrency(expense.amount),
            expense.note || "",
          ]),
        ],
      },
      {
        name: "Kurset",
        rows: [
          ["Nr", "Emri i kursit", "Lloji", "Cmimi"],
          ...courses.map((course, index) => [index + 1, course.name, pricingTypeLabel(course.pricingType), formatExportCurrency(course.price)]),
        ],
      },
      {
        name: "Archive Nxenes",
        rows: [
          ["Nr", "Emri", "Mbiemri", "Kursi", "Muaji", "Grupi", "Mesuesi"],
          ...archive.students.map((student, index) => [
            index + 1,
            student.firstName || student.name,
            student.lastName || "",
            student.course || "",
            formatMonthYear(student.group),
            student.studentGroup || "",
            teacherById(student.teacherId)?.name || "Pa mesues",
          ]),
        ],
      },
      {
        name: "Archive Mesues",
        rows: [
          ["Nr", "Emri", "Mbiemri", "Email", "Perqindja"],
          ...archive.teachers.map((teacher, index) => [
            index + 1,
            teacher.firstName || teacher.name,
            teacher.lastName || "",
            teacher.email || "",
            `${teacher.percent}%`,
          ]),
        ],
      },
      {
        name: "Archive Pagesa",
        rows: [
          ["Nr", "Nxenesi", "Mesuesi", "Shuma", "Orët", "Çmimi/orë", "Data", "Shenime"],
          ...archive.payments.map((payment, index) => [
            index + 1,
            payment.studentName || "Pa student",
            payment.teacherName || "Pa mesues",
            formatExportCurrency(payment.amount),
            payment.paymentType === "hourly" ? payment.hours || "" : "",
            payment.paymentType === "hourly" ? formatExportCurrency(payment.rate) : "",
            formatDateDisplay(payment.date),
            payment.note || "",
          ]),
        ],
      },
      {
        name: "Archive Kurse",
        rows: [
          ["Nr", "Emri i kursit", "Lloji", "Cmimi"],
          ...(archive.courses || []).map((course, index) => [index + 1, course.name, pricingTypeLabel(course.pricingType), formatExportCurrency(course.price)]),
        ],
      },
      {
        name: "Archive Shpenzime",
        rows: [
          ["Nr", "Produkti / Shpenzimi", "Data", "Cmimi", "Shenime"],
          ...(archive.expenses || []).map((expense, index) => [
            index + 1,
            expense.name,
            formatDateDisplay(expense.date),
            formatExportCurrency(expense.amount),
            expense.note || "",
          ]),
        ],
      },
    ];

    const months = [...new Set([
      ...payments.map((payment) => monthFromDate(payment.date)),
      ...expenses.map((expense) => monthFromDate(expense.date)),
      ...enrollments.map((enrollment) => enrollment.group),
    ].filter(Boolean))].sort();
    const monthlySheets = months.flatMap((month) => {
      const monthPayments = payments.filter((payment) => monthFromDate(payment.date) === month);
      const monthExpenses = expenses.filter((expense) => monthFromDate(expense.date) === month);
      const monthTeacherRows = teachers.map((teacher, index) => {
        const teacherPayments = monthPayments.filter((payment) => sameId(paymentTeacher(payment)?.id, teacher.id));
        const { total, teacherShare, adminShare, schoolShare } = summarizeTeacherPayments(teacher, teacherPayments);
        return [
          index + 1,
          teacher.firstName || teacher.name,
          teacher.lastName || "",
          teacher.email || "",
          `${teacher.percent}%`,
          studentsWithEnrollment.filter((student) => sameId(student.teacherId, teacher.id) && student.group === month).length,
          formatExportCurrency(total),
          formatExportCurrency(teacherShare),
          formatExportCurrency(adminShare),
          formatExportCurrency(schoolShare),
          formatExportCurrency(total - teacherShare - adminShare - schoolShare),
        ];
      });
      const monthIncome = monthPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const monthTeacherPay = monthTeacherRows.reduce((sum, row) => sum + parseMoney(row[7]), 0);
      const monthAdminShare = monthPayments.reduce(
        (sum, payment) => sum + Number(payment.amount || 0) * (paymentAdminPercentValue(payment) / 100),
        0
      );
      const monthSchoolShare = teachers.reduce((sum, teacher) => {
        const teacherPayments = monthPayments.filter((payment) => sameId(paymentTeacher(payment)?.id, teacher.id));
        return sum + summarizeTeacherPayments(teacher, teacherPayments).schoolShare;
      }, 0);
      const monthExpenseTotal = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

      return [
        {
          name: `Pagesat ${month}`,
          rows: [
            ["Nr", "Nxenesi", "Mesuesi", "Shuma", "Oret", "Cmimi/ore", "Data", "Mesuesi %", "Administrata %", "Shkolla %", "Shenime"],
            ...monthPayments.map((payment, index) => [
              index + 1,
              payment.studentName || studentById(payment.studentId)?.name || "Pa student",
              payment.teacherName || paymentTeacher(payment)?.name || "Pa mesues",
              formatExportCurrency(payment.amount),
              payment.paymentType === "hourly" ? payment.hours || "" : "",
              payment.paymentType === "hourly" ? formatExportCurrency(payment.rate) : "",
              formatDateDisplay(payment.date),
              `${paymentTeacherPercentValue(payment, paymentTeacher(payment))}%`,
              `${paymentAdminPercentValue(payment)}%`,
              `${paymentSchoolPercentValue(payment)}%`,
              payment.note || "",
            ]),
          ],
        },
        {
          name: `Paga ${month}`,
          rows: [
            ["Nr", "Emri", "Mbiemri", "Email", "%", "Nxenes", "Total", "Mesuesi", "Administrata", "Shkolla", "Mbetja"],
            ...monthTeacherRows,
          ],
        },
        {
          name: `Financa ${month}`,
          rows: [
            ["Kategoria", "Totali"],
            ["Te hyrat totale", formatExportCurrency(monthIncome)],
            ["Pagat e mesuesve", formatExportCurrency(monthTeacherPay)],
            ["Administrata", formatExportCurrency(monthAdminShare)],
            ["Shkolla", formatExportCurrency(monthSchoolShare)],
            ["Buxheti i shkolles", formatExportCurrency(monthSchoolShare - monthExpenseTotal)],
            ["Shpenzimet", formatExportCurrency(monthExpenseTotal)],
          ],
        },
        {
          name: `Shpenzime ${month}`,
          rows: [
            ["Nr", "Produkti / Shpenzimi", "Data", "Cmimi", "Shenime"],
            ...monthExpenses.map((expense, index) => [
              index + 1,
              expense.name,
              formatDateDisplay(expense.date),
              formatExportCurrency(expense.amount),
              expense.note || "",
            ]),
          ],
        },
      ];
    });

    [...sheets, ...monthlySheets].forEach((sheet) => {
      XLSX.utils.book_append_sheet(workbook, sheetFromRows(sheet.rows), sheet.name);
    });
    XLSX.writeFile(workbook, `vatra_export_${currentDateInput()}.xlsx`);
  };

  const importAllData = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !canManageData) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const archivedAt = new Date().toISOString();
      const teacherRows = [
        ...getWorkbookRows(workbook, ["Mesuesit", "Mësuesit"]).map((row) => ({ row, archivedAt: null })),
        ...getWorkbookRows(workbook, ["Archive Mesues", "Archive Mësues"]).map((row) => ({ row, archivedAt })),
      ];
      const courseRows = [
        ...getWorkbookRows(workbook, ["Kurset"]).map((row) => ({ row, archivedAt: null })),
        ...getWorkbookRows(workbook, ["Archive Kurse"]).map((row) => ({ row, archivedAt })),
      ];

      const teachersToImport = teacherRows
        .map(({ row, archivedAt: rowArchivedAt }) => {
          const firstName = getExcelValue(row, ["Emri"]);
          const lastName = getExcelValue(row, ["Mbiemri"]);
          const percent = parseMoney(getExcelValue(row, ["Perqindja", "Përqindja", "%"])) || 80;
          if (!firstName && !lastName) return null;
          const teacher = {
            name: [firstName, lastName].filter(Boolean).join(" "),
            firstName,
            lastName,
            email: normalizeEmail(getExcelValue(row, ["Email", "Emaili", "Emaili i mesuesit", "Emaili i mësuesit"])),
            percent,
          };
          return { ...teacherToRow(teacher), archived_at: rowArchivedAt };
        })
        .filter(Boolean);

      const coursesToImport = courseRows
        .map(({ row, archivedAt: rowArchivedAt }) => {
          const name = getExcelValue(row, ["Emri i kursit", "Kursi", "Emri"]);
          const typeLabel = normalizeExcelKey(getExcelValue(row, ["Lloji", "Tipi"]));
          const price = parseMoney(getExcelValue(row, ["Cmimi", "Çmimi", "Price"]));
          if (!name) return null;
          return {
            ...courseToRow({
              name,
              price,
              pricingType: typeLabel.includes("meore") || typeLabel.includes("hour") ? "hourly" : "fixed",
            }),
            archived_at: rowArchivedAt,
          };
        })
        .filter(Boolean);

      const [savedTeachersResult, savedCoursesResult] = await Promise.all([
        teachersToImport.length ? supabase.from("teachers").insert(teachersToImport).select("*") : { data: [], error: null },
        coursesToImport.length ? supabase.from("courses").insert(coursesToImport).select("*") : { data: [], error: null },
      ]);
      if (savedTeachersResult.error) throw savedTeachersResult.error;
      if (savedCoursesResult.error) throw savedCoursesResult.error;

      const importedTeachers = (savedTeachersResult.data || []).map(normalizeTeacher);
      const teacherLookup = [...teachers, ...importedTeachers];
      const teacherByName = (name) =>
        teacherLookup.find((teacher) => normalizeExcelKey(teacher.name) === normalizeExcelKey(name));

      const studentRows = [
        ...getWorkbookRows(workbook, ["Nxenesit", "Nxënësit"]).map((row) => ({ row, archivedAt: null })),
        ...getWorkbookRows(workbook, ["Archive Nxenes", "Archive Nxënës"]).map((row) => ({ row, archivedAt })),
      ];
      const studentsToImport = studentRows
        .map(({ row, archivedAt: rowArchivedAt }) => {
          const firstName = getExcelValue(row, ["Emri"]);
          const lastName = getExcelValue(row, ["Mbiemri"]);
          const fullName = getExcelValue(row, ["Nxenesi", "Nxënësi", "Emri Mbiemri"]);
          const nameParts = fullName.split(" ").filter(Boolean);
          const finalFirstName = firstName || nameParts[0] || "";
          const finalLastName = lastName || nameParts.slice(1).join(" ");
          const name = [finalFirstName, finalLastName].filter(Boolean).join(" ");
          if (!name) return null;
          const teacher = teacherByName(getExcelValue(row, ["Mesuesi", "Mësuesi", "Teacher"]));
          const student = {
            name,
            firstName: finalFirstName,
            lastName: finalLastName,
            age: getExcelValue(row, ["Mosha", "Age"]),
            city: getExcelValue(row, ["Qyteti", "City"]),
            phone: getExcelValue(row, ["Telefoni", "Numri i telefonit", "Phone"]),
            email: getExcelValue(row, ["Emaili", "Email"]),
            course: getExcelValue(row, ["Kursi", "Course"]),
            group: parseMonthYear(getExcelValue(row, ["Muaji", "Month"])),
            studentGroup: getExcelValue(row, ["Grupi", "Group"]),
            teacherId: teacher?.id ?? null,
          };
          return { ...studentToRow(student), archived_at: rowArchivedAt };
        })
        .filter(Boolean);

      const savedStudentsResult = studentsToImport.length
        ? await supabase.from("students").insert(studentsToImport).select("*")
        : { data: [], error: null };
      if (savedStudentsResult.error) throw savedStudentsResult.error;
      const importedStudents = (savedStudentsResult.data || []).map(normalizeStudent);
      const importedEnrollmentRows = importedStudents
        .map((student) => enrollmentToRow(buildEnrollmentFromStudent(student, student.id)))
        .filter((row) => row.course_name);
      const savedEnrollmentsResult = importedEnrollmentRows.length
        ? await supabase.from("enrollments").insert(importedEnrollmentRows).select("*")
        : { data: [], error: null };
      if (savedEnrollmentsResult.error) throw savedEnrollmentsResult.error;
      const importedEnrollments = (savedEnrollmentsResult.data || []).map(normalizeEnrollment);
      const enrollmentLookup = [...enrollments, ...importedEnrollments];
      const enrollmentForImportedStudent = (student) =>
        enrollmentLookup.find((enrollment) => sameId(enrollment.studentId, student?.id) && enrollment.status === "active") ||
        enrollmentLookup.find((enrollment) => sameId(enrollment.studentId, student?.id));
      const studentLookup = [...students, ...importedStudents];
      const studentByName = (name) =>
        studentLookup.find((student) => normalizeExcelKey(student.name) === normalizeExcelKey(name));

      const paymentRows = [
        ...getWorkbookRows(workbook, ["Pagesat"]).map((row) => ({ row, archivedAt: null })),
        ...getWorkbookRows(workbook, ["Archive Pagesa"]).map((row) => ({ row, archivedAt })),
      ];
      const paymentsToImport = paymentRows
        .map(({ row, archivedAt: rowArchivedAt }) => {
          const studentName = getExcelValue(row, ["Nxenesi", "Nxënësi", "Student"]);
          const teacherName = getExcelValue(row, ["Mesuesi", "Mësuesi", "Teacher"]);
          const student = studentByName(studentName);
          const teacher = teacherByName(teacherName);
          const enrollment = enrollmentForImportedStudent(student);
          const amount = parseMoney(getExcelValue(row, ["Shuma", "Pagesa", "Amount"]));
          if (!amount && !studentName) return null;
          const hours = getExcelValue(row, ["Oret", "Orët", "Hours"]);
          const rate = getExcelValue(row, ["Cmimi/ore", "Çmimi/orë", "€/orë", "Rate"]);
          const payment = {
            studentId: student?.id ?? null,
            studentName: student?.name || studentName || "Pa student",
            enrollmentId: enrollment?.id || "",
            courseId: enrollment?.courseId || "",
            courseName: enrollment?.course || student?.course || "",
            groupName: enrollment?.studentGroup || student?.studentGroup || "",
            paymentMonth: monthFromDate(parseDateInput(getExcelValue(row, ["Data", "Date"]))),
            teacherId: teacher?.id ?? enrollment?.teacherId ?? student?.teacherId ?? null,
            teacherName: teacher?.name || enrollment?.teacherName || teacherName || "Pa mesues",
            amount,
            teacherPercent: parseMoney(getExcelValue(row, ["Mesuesi %", "Mësuesi %"])) || 80,
            adminPercent: parseMoney(getExcelValue(row, ["Administrata %"])) || 15,
            schoolPercent: parseMoney(getExcelValue(row, ["Shkolla %"])) || 5,
            paymentType: hours ? "hourly" : "fixed",
            hours,
            rate: rate ? parseMoney(rate) : "",
            note: getExcelValue(row, ["Shenime", "Shënime", "Note"]),
            date: parseDateInput(getExcelValue(row, ["Data", "Date"])),
          };
          return { ...paymentToRow(payment), archived_at: rowArchivedAt };
        })
        .filter(Boolean);

      const expenseRows = [
        ...getWorkbookRows(workbook, ["Shpenzime"]).map((row) => ({ row, archivedAt: null })),
        ...getWorkbookRows(workbook, ["Archive Shpenzime"]).map((row) => ({ row, archivedAt })),
      ];
      const expensesToImport = expenseRows
        .map(({ row, archivedAt: rowArchivedAt }) => {
          const name = getExcelValue(row, ["Produkti / Shpenzimi", "Produkti", "Shpenzimi"]);
          const amount = parseMoney(getExcelValue(row, ["Cmimi", "Çmimi", "Amount"]));
          if (!name) return null;
          const expense = {
            name,
            date: parseDateInput(getExcelValue(row, ["Data", "Date"])),
            amount,
            note: getExcelValue(row, ["Shenime", "Shënime", "Note"]),
          };
          return { ...expenseToRow(expense), archived_at: rowArchivedAt };
        })
        .filter(Boolean);

      const [savedPaymentsResult, savedExpensesResult] = await Promise.all([
        paymentsToImport.length ? supabase.from("payments").insert(paymentsToImport).select("*") : { error: null },
        expensesToImport.length ? supabase.from("expenses").insert(expensesToImport).select("*") : { error: null },
      ]);
      if (savedPaymentsResult.error) throw savedPaymentsResult.error;
      if (savedExpensesResult.error) throw savedExpensesResult.error;

      await loadSupabaseData({ showLoading: false });
      window.alert("Importi i te gjitha te dhenave perfundoi.");
    } catch (error) {
      reportDataError(error);
    } finally {
      event.target.value = "";
    }
  };

  const selectedEnrollmentStudent = studentsWithEnrollment.find((student) => sameId(student.id, enrollmentStudentId));
  const selectedEnrollmentRows = enrollmentStudentId ? studentEnrollmentRows(enrollmentStudentId) : [];
  const sortedSelectedEnrollmentRows = sortRows(selectedEnrollmentRows, "enrollments", {
    course: (enrollment) => enrollment.course,
    group: (enrollment) => enrollment.group,
    studentGroup: (enrollment) => enrollment.studentGroup,
    teacherName: (enrollment) =>
      enrollment.teacherName || teachers.find((teacher) => sameId(teacher.id, enrollment.teacherId))?.name || "",
    status: (enrollment) => enrollmentStatusLabel(enrollment.status),
  });

  const selectedPaymentStudentDetails = studentsWithEnrollment.find((student) => sameId(student.id, selectedStudent));
  const selectedDetailsStudent = studentsWithEnrollment.find((student) => sameId(student.id, detailsStudentId));
  const selectedPaymentEnrollmentOptions = selectedStudent ? paymentEnrollmentOptionsForStudent(selectedStudent) : [];
  const selectedPaymentEnrollmentDetails =
    selectedPaymentEnrollmentOptions.find((enrollment) => sameId(enrollment.id, selectedPaymentEnrollmentId)) || null;
  const selectedPaymentCourseDetails = selectedPaymentEnrollmentDetails
    ? getStudentCourse({ course: selectedPaymentEnrollmentDetails.course, courseId: selectedPaymentEnrollmentDetails.courseId })
    : selectedPaymentStudentDetails
      ? getStudentCourse(selectedPaymentStudentDetails)
      : null;
  const editingPaymentEnrollmentOptions = editingPaymentStudentId ? paymentEnrollmentOptionsForStudent(editingPaymentStudentId) : [];
  const editingPaymentEnrollmentDetails =
    editingPaymentEnrollmentOptions.find((enrollment) => sameId(enrollment.id, editingPaymentEnrollmentId)) || null;
  const isSelectedPaymentHourly = isHourlyCourse(selectedPaymentCourseDetails);
  const isEditingPaymentHourly = editingPaymentType === "hourly" || isHourlyCourse(
    editingPaymentEnrollmentDetails
      ? getStudentCourse({ course: editingPaymentEnrollmentDetails.course, courseId: editingPaymentEnrollmentDetails.courseId })
      : null
  );

  const navItems = useMemo(() => [
    { key: "students", label: "Nxënësit" },
    { key: "teachers", label: "Mësuesit" },
    { key: "payments", label: "Pagesat" },
    { key: "paga", label: "Paga" },
    { key: "finance", label: "Financa" },
    { key: "courses", label: "Kurset" },
    { key: "archive", label: "Arkiva" },
  ], []);
  const visibleNavItems = useMemo(
    () => (isTeacherUser ? navItems.filter((item) => !["finance", "archive"].includes(item.key)) : navItems),
    [isTeacherUser, navItems]
  );

  useEffect(() => {
    if (visibleNavItems.some((item) => item.key === activeView)) return;
    setActiveView("students");
  }, [activeView, visibleNavItems]);

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

  if (hasLoadedData && !hasAppAccess) {
    return (
      <div className={`${shell} flex min-h-screen items-center justify-center p-4`} style={{ background: HIGHLIGHT }}>
        <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-xl">
          <div className="mb-4 flex justify-center">
            <BrandMark />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: PRIMARY }}>Vatra e Diturisë</h1>
          <p className="mt-3 text-gray-600">
            Ky email nuk ka qasje në aplikacion. Shto emailin te tabela e mësuesve ose te VITE_ADMIN_EMAILS.
          </p>
          <button type="button" onClick={signOut} className={`${mainBtn} mt-5`} style={dangerBtnStyle}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${shell} h-dvh min-h-0 overflow-hidden flex flex-col lg:flex-row`}
      style={{ background: HIGHLIGHT }}
      onClick={clearRowSelections}
    >
      <button
        type="button"
        onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
        className={`fixed top-3 z-[60] flex h-12 w-12 items-center justify-center rounded-lg bg-white shadow-md transition-all duration-200 lg:hidden ${
          isMobileSidebarOpen
            ? "pointer-events-none left-0 -translate-x-full opacity-0"
            : "left-0 -translate-x-1/2 opacity-100"
        }`}
        aria-label="Hap sidebar"
        title="Hap sidebar"
      >
        <img src={sidebarIcon} alt="" className="h-6 w-6" />
      </button>
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
      )}
      <aside className={`app-sidebar fixed inset-y-0 left-0 z-50 flex min-h-screen w-72 max-w-[82vw] shrink-0 flex-col overflow-hidden border-r ${sidebar} p-3 sm:p-4 lg:static lg:h-full lg:min-h-0 lg:max-w-none lg:p-3 lg:translate-x-0 transition-transform duration-200 ${isSidebarCollapsed ? "lg:w-20" : "lg:w-64"} ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`} style={{ background: PRIMARY }}>
        <div className="flex-1 min-h-0">
          <div className={`sidebar-brand flex items-center justify-center gap-3 mb-3 lg:mb-4 ${isSidebarCollapsed ? "lg:justify-center" : "lg:justify-start"}`}>
            <BrandMark />
            <div className={`sidebar-brand-title text-base sm:text-lg font-bold leading-tight text-white ${isSidebarCollapsed ? "lg:hidden" : ""}`}>
              Vatra e Dituris&euml;
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className={`sidebar-collapse-button mb-2 hidden h-10 w-full items-center rounded-lg transition hover:bg-white/10 lg:flex ${isSidebarCollapsed ? "lg:justify-center lg:px-0" : "lg:justify-start lg:px-3"}`}
            aria-label={isSidebarCollapsed ? "Hap sidebar" : "Mbyll sidebar"}
            title={isSidebarCollapsed ? "Hap sidebar" : "Mbyll sidebar"}
          >
            <img
              src={sidebarIcon}
              alt=""
              className="h-6 w-6"
            />
          </button>
          <div className="sidebar-nav space-y-2 lg:space-y-1.5">
            {visibleNavItems.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setActiveView(item.key);
                  setIsMobileSidebarOpen(false);
                }}
                className={`sidebar-nav-button w-full px-3 py-2 lg:py-1.5 rounded-lg text-left text-sm transition hover:bg-white/10 sm:text-base ${isSidebarCollapsed ? "lg:text-center" : "lg:text-left"}`}
                style={activeView === item.key ? activeNavStyle : inactiveNavStyle}
                title={item.label}
              >
                <span className={isSidebarCollapsed ? "lg:hidden" : ""}>{item.label}</span>
                <span className={`hidden ${isSidebarCollapsed ? "lg:inline" : ""}`}>{item.label.slice(0, 1)}</span>
              </button>
            ))}
          </div>
        </div>
        {isTeacherUser && (
          <div
            className={`mt-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white ${
              isSidebarCollapsed ? "lg:text-center" : ""
            }`}
            title={currentTeacherAccount?.name || currentUser?.email}
          >
            <span className={isSidebarCollapsed ? "lg:hidden" : ""}>
              {currentTeacherAccount?.name || currentUser?.email}
            </span>
            <span className={`hidden ${isSidebarCollapsed ? "lg:inline" : ""}`}>
              {(currentTeacherAccount?.name || currentUser?.email || "M").slice(0, 1)}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsSettingsModalOpen(true)}
          className="sidebar-settings-button mt-2 flex h-11 w-full shrink-0 items-center justify-start gap-3 rounded-lg px-3 text-base font-semibold text-white transition hover:bg-white/10"
          aria-label="Settings"
          title="Settings"
        >
          <img src={settingsIcon} alt="" className="h-6 w-6 shrink-0" />
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
        {canManageData && isLastDayOfMonth && !isMonthEndReminderDismissed && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>Sot është dita e fundit e muajit. Mos harro me i bo export në Excel të gjitha të dhënat.</span>
              <button type="button" onClick={() => setIsMonthEndReminderDismissed(true)} className={smallBtn} style={secondaryBtnStyle}>
                Mbylle
              </button>
            </div>
          </div>
        )}
        {activeView === "students" && (
          <div className={`border rounded-lg lg:rounded-2xl shadow-sm ${card} p-3 sm:p-4`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: PRIMARY }}>Nxënësit</h2>
                <p className="text-gray-500">Menaxho nxënësit dhe mësuesin përkatës.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 w-full lg:w-[58rem]">
                {searchField({
                  value: studentSearch,
                  onChange: (e) => setStudentSearch(e.target.value),
                  placeholder: "Kërko sipas emrit ose mësuesit",
                })}
                <input className={dateInput} type="month" value={studentGroupFilter} onChange={(e) => setStudentGroupFilter(e.target.value)} />
                <SearchableSelect
                  className={input}
                  value={studentStatusFilter}
                  onChange={setStudentStatusFilter}
                  placeholder="Statusi"
                  options={studentStatusOptions}
                />
                <button onClick={() => { setStudentGroupFilter(""); setStudentStatusFilter(""); }} className={mainBtn} style={secondaryBtnStyle}>
                  {actionLabel("clear", "Pastro filtrin")}
                </button>
              </div>
            </div>

            {canManageData && (
            <div className="flex flex-col sm:flex-row justify-end gap-2 mb-6">
              <input
                ref={studentImportRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={importStudentsFromExcel}
              />
              <button onClick={() => studentImportRef.current?.click()} className={mainBtn} style={secondaryBtnStyle}>{actionLabel("import", "Importo nxënës")}</button>
              <button onClick={() => { setStudentForm({ ...emptyStudentForm, group: currentMonthInput() }); setIsStudentModalOpen(true); }} className={mainBtn} style={primaryBtnStyle}>{actionLabel("add", "Shto nxënës")}</button>
            </div>
            )}

            <div className={tableWrap}>
              <table className="min-w-[76rem] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={thClass}>Nr</th>
                    <th className={thClass}>{sortButton("students", "firstName", "Emri")}</th>
                    <th className={thClass}>{sortButton("students", "lastName", "Mbiemri")}</th>
                    <th className={thClass}>{sortButton("students", "course", "Kursi")}</th>
                    <th className={thClass}>{sortButton("students", "group", "Muaji")}</th>
                    <th className={thClass}>{sortButton("students", "studentGroup", "Grupi")}</th>
                    <th className={thClass}>{sortButton("students", "status", "Statusi")}</th>
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
                      <tr
                        key={student.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedStudentView((prev) => (prev === student.id ? null : student.id));
                        }}
                        className={`${rowHover} cursor-pointer ${isSelected ? selectedRow : ""}`}
                      >
                        <td className={tdClass}>{index + 1}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingStudentFirstName} onChange={(e) => setEditingStudentFirstName(e.target.value)} /> : (student.firstName || student.name)}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingStudentLastName} onChange={(e) => setEditingStudentLastName(e.target.value)} /> : (student.lastName || "-")}</td>
                        <td className={tdClass}>{isEditing ? (
                          <SearchableSelect
                            className={input}
                            value={editingStudentCourse}
                            onChange={setEditingStudentCourse}
                            placeholder="Zgjedh kursin"
                            options={[
                              { value: "", label: "Zgjedh kursin" },
                              ...(editingStudentCourse && !courses.some((course) => course.name === editingStudentCourse)
                                ? [{ value: editingStudentCourse, label: editingStudentCourse }]
                                : []),
                              ...sortedCoursesAlpha.map((course) => ({ value: course.name, label: course.name })),
                            ]}
                          />
                        ) : (student.course || "-")}</td>
                        <td className={tdClass}>{isEditing ? <input className={dateInput} type="month" value={editingStudentGroup} onChange={(e) => setEditingStudentGroup(e.target.value)} /> : formatMonthYear(student.group)}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingStudentStudentGroup} onChange={(e) => setEditingStudentStudentGroup(e.target.value)} placeholder="gr1" /> : (student.studentGroup || "-")}</td>
                        <td className={tdClass}>{enrollmentStatusLabel(student.enrollmentStatus)}</td>
                        <td className={tdClass}>
                          {isTeacherUser && !sameId(student.teacherId, currentTeacherId) ? (
                            "-"
                          ) : hasPayment && !isEditing ? (
                            <img
                              src={doneIcon}
                              alt="E paguar"
                              className="h-5 w-5"
                            />
                          ) : canManageData ? (
                            <input
                              type="checkbox"
                              checked={false}
                              readOnly
                              onChange={() => {}}
                              onClick={(e) => {
                                e.stopPropagation();
                                openPaymentModalForStudent(student);
                              }}
                              className={roundCheckbox}
                            />
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className={tdClass}>
                          {isEditing ? (
                            <SearchableSelect
                              className={input}
                              value={editingStudentTeacherId}
                              onChange={setEditingStudentTeacherId}
                              placeholder="Zgjedh mësuesin"
                              options={[
                                { value: "", label: "Zgjedh mësuesin" },
                                ...sortedTeachersAlpha.map((teacherOption) => ({
                                  value: teacherOption.id,
                                  label: teacherOption.name,
                                })),
                              ]}
                            />
                          ) : (teacher?.name || "Pa mësues")}
                        </td>
                        <td className={tdClass}>
                          <div className="flex flex-wrap gap-2">
                            {isEditing ? (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); saveEditStudent(); }} className={smallBtn} style={primaryBtnStyle}>Save</button>
                                <button onClick={(e) => { e.stopPropagation(); cancelEditStudent(); }} className={smallBtn} style={secondaryBtnStyle}>Cancel</button>
                              </>
                            ) : canManageData ? (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); setDetailsStudentId(student.id); }} className={smallBtn} style={primaryBtnStyle}>{actionLabel("information", "Shfaq të dhënat")}</button>
                                <button onClick={(e) => { e.stopPropagation(); startEditStudent(student); }} className={smallBtn} style={secondaryBtnStyle}>{actionLabel("edit", "Edit")}</button>
                                <button onClick={(e) => { e.stopPropagation(); openEnrollmentModal(student); }} className={smallBtn} style={primaryBtnStyle}>{actionLabel("courses", "Kurset")}</button>
                                <button onClick={(e) => { e.stopPropagation(); archiveStudent(student); }} className={smallBtn} style={warningBtnStyle}>{actionLabel("archive", "Archive")}</button>
                              </>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); setDetailsStudentId(student.id); }} className={smallBtn} style={primaryBtnStyle}>{actionLabel("information", "Shfaq të dhënat")}</button>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-[44rem]">
                {searchField({
                  value: teacherSearch,
                  onChange: (e) => setTeacherSearch(e.target.value),
                  placeholder: "Kërko sipas emrit ose nxënësve",
                })}
                <input className={dateInput} type="month" value={teacherMonthFilter} onChange={(e) => setTeacherMonthFilter(e.target.value)} />
                <button onClick={() => setTeacherMonthFilter("")} className={mainBtn} style={secondaryBtnStyle}>
                  {actionLabel("clear", "Pastro filtrin")}
                </button>
              </div>
            </div>

            {canManageData && (
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
            )}

            <div className={tableWrap}>
              <table className="min-w-[62rem] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={thClass}>Nr</th>
                    <th className={thClass}>{sortButton("teachers", "name", "Emri")}</th>
                    <th className={thClass}>{sortButton("teachers", "lastName", "Mbiemri")}</th>
                    <th className={thClass}>{sortButton("teachers", "email", "Email")}</th>
                    <th className={thClass}>Përqindja</th>
                    <th className={thClass}>{sortButton("teachers", "studentsCount", "Nxënës")}</th>
                    <th className={thClass}>Veprime</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTeachers.map((teacher, index) => {
                    const isSelected = selectedTeacherView === teacher.id;
                    const isEditing = editingTeacherId === teacher.id;
                    const countStudents = teacherStudentsForMonth(teacher.id).length;
                    return (
                      <tr
                        key={teacher.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedTeacherView((prev) => (prev === teacher.id ? null : teacher.id));
                        }}
                        className={`${rowHover} cursor-pointer ${isSelected ? selectedRow : ""}`}
                      >
                        <td className={tdClass}>{index + 1}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingTeacherFirstName} onChange={(e) => setEditingTeacherFirstName(e.target.value)} /> : (teacher.firstName || teacher.name)}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingTeacherLastName} onChange={(e) => setEditingTeacherLastName(e.target.value)} /> : (teacher.lastName || "-")}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingTeacherEmail} onChange={(e) => setEditingTeacherEmail(e.target.value)} type="email" /> : (teacher.email || "-")}</td>
                        <td className={tdClass}>{isEditing ? (
                          <SearchableSelect
                            className={input}
                            value={editingTeacherPercent}
                            onChange={setEditingTeacherPercent}
                            placeholder="Përqindja"
                            options={percentOptions.map((percent) => ({ value: percent, label: `${percent}%` }))}
                          />
                        ) : `${teacher.percent}%`}</td>
                        <td className={tdClass}>{countStudents}</td>
                        <td className={tdClass}>
                          <div className="flex flex-wrap gap-2">
                            {isEditing ? (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); saveEditTeacher(); }} className={smallBtn} style={primaryBtnStyle}>Save</button>
                                <button onClick={(e) => { e.stopPropagation(); setEditingTeacherId(null); setEditingTeacherEmail(""); }} className={smallBtn} style={secondaryBtnStyle}>Cancel</button>
                              </>
                            ) : canManageData ? (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); startEditTeacher(teacher); }} className={smallBtn} style={secondaryBtnStyle}>{actionLabel("edit", "Edit")}</button>
                                <button onClick={(e) => { e.stopPropagation(); archiveTeacher(teacher); }} className={smallBtn} style={warningBtnStyle}>{actionLabel("archive", "Archive")}</button>
                              </>
                            ) : (
                              <span className="text-gray-500">Vetëm lexim</span>
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
                  <table className="min-w-[48rem] w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className={thClass}>Nr</th>
                        <th className={thClass}>{sortButton("selectedTeacherStudents", "name", "Emri")}</th>
                        <th className={thClass}>{sortButton("selectedTeacherStudents", "lastName", "Mbiemri")}</th>
                        <th className={thClass}>{sortButton("selectedTeacherStudents", "course", "Kursi")}</th>
                        <th className={thClass}>{sortButton("selectedTeacherStudents", "group", "Muaji")}</th>
                        <th className={thClass}>{sortButton("selectedTeacherStudents", "studentGroup", "Grupi")}</th>
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
                            <td className={tdClass}>{formatMonthYear(student.group)}</td>
                            <td className={tdClass}>{student.studentGroup || "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className={tdClass} colSpan={6}>
                            {teacherMonthFilter ? "Ky mësues nuk ka nxënës për këtë muaj." : "Ky mësues nuk ka nxënës."}
                          </td>
                        </tr>
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 w-full xl:w-[56rem]">
                {searchField({
                  value: paymentSearch,
                  onChange: (e) => setPaymentSearch(e.target.value),
                  placeholder: "Kërko pagesa",
                })}
                <SearchableSelect
                  className={input}
                  value={isTeacherUser ? currentTeacherAccount?.name || "" : activePaymentTeacherFilter}
                  onChange={isTeacherUser ? () => {} : setPaymentTeacherFilter}
                  placeholder="Të gjithë mësuesit"
                  disabled={isTeacherUser}
                  options={isTeacherUser
                    ? [{ value: currentTeacherAccount?.name || "", label: currentTeacherAccount?.name || "Mësuesi" }]
                    : [
                        { value: "", label: "Të gjithë mësuesit" },
                        ...sortedTeachersAlpha.map((teacher) => ({ value: teacher.name, label: teacher.name })),
                      ]}
                />
                <input className={dateInput} type="month" value={paymentMonthFilter} onChange={(e) => setPaymentMonthFilter(e.target.value)} />
                <button onClick={() => setPaymentMonthFilter("")} className={mainBtn} style={secondaryBtnStyle}>
                  {actionLabel("clear", "Pastro filtrin")}
                </button>
              </div>
            </div>

            {canManageData && (
            <div className="flex justify-end mb-6">
              <button onClick={openPaymentModal} className={mainBtn} style={secondaryBtnStyle}>{actionLabel("add", "Shto pagesë")}</button>
            </div>
            )}

            <div className={tableWrap}>
              <table className="min-w-[64rem] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={thClass}>Nr</th>
                    <th className={thClass}>{sortButton("payments", "studentName", "Nxënësi")}</th>
                    <th className={thClass}>{sortButton("payments", "teacherName", "Mësuesi")}</th>
                    <th className={thClass}>{sortButton("payments", "amount", "Shuma")}</th>
                    <th className={thClass}>Orët</th>
                    <th className={thClass}>€/orë</th>
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
                          <div className="space-y-2">
                            <SearchableSelect
                              className={input}
                              value={editingPaymentStudentId}
                              onChange={changeEditingPaymentStudent}
                              placeholder="Zgjedh nxënësin"
                              options={[
                                { value: "", label: "Zgjedh nxënësin" },
                                ...sortedStudentsAlpha.map((student) => ({
                                  value: student.id,
                                  label: studentOptionLabel(student),
                                })),
                              ]}
                            />
                            {editingPaymentEnrollmentOptions.length > 1 && (
                              <SearchableSelect
                                className={input}
                                value={editingPaymentEnrollmentId}
                                onChange={changeEditingPaymentEnrollment}
                                placeholder="Zgjedh kursin"
                                options={editingPaymentEnrollmentOptions.map((enrollment) => ({
                                  value: enrollment.id,
                                  label: paymentEnrollmentLabel(enrollment),
                                }))}
                              />
                            )}
                          </div>
                        ) : payment.studentName}</td>
                        <td className={tdClass}>{payment.teacherName}</td>
                        <td className={tdClass}>{isEditing ? (
                          <input className={input} value={editingPaymentAmount} onChange={(e) => setEditingPaymentAmount(e.target.value)} type="number" min="0" step="0.01" />
                        ) : formatCurrency(payment.amount)}</td>
                        <td className={tdClass}>{isEditing && isEditingPaymentHourly ? (
                          <input className={input} value={editingPaymentHours} onChange={(e) => changeEditingPaymentHours(e.target.value)} type="number" min="0" step="0.25" />
                        ) : (payment.paymentType === "hourly" ? payment.hours || "-" : "-")}</td>
                        <td className={tdClass}>{isEditing && isEditingPaymentHourly ? (
                          <input className={input} value={editingPaymentRate} onChange={(e) => changeEditingPaymentRate(e.target.value)} type="number" min="0" step="0.01" />
                        ) : (payment.paymentType === "hourly" ? formatCurrency(payment.rate) : "-")}</td>
                        <td className={tdClass}>{isEditing ? (
                          <DateTextInput className={dateInput} value={editingPaymentDate} onChange={setEditingPaymentDate} />
                        ) : formatDateDisplay(payment.date)}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingPaymentNote} onChange={(e) => setEditingPaymentNote(e.target.value)} /> : (payment.note || "-")}</td>
                        <td className={tdClass}>
                          <div className="flex flex-wrap gap-2">
                            {isEditing ? (
                              <>
                                <button onClick={saveEditPayment} className={smallBtn} style={primaryBtnStyle}>Save</button>
                                <button onClick={() => { setEditingPaymentId(null); setEditingPaymentEnrollmentId(""); setEditingPaymentDate(""); setEditingPaymentNote(""); setEditingPaymentHours(""); setEditingPaymentRate(""); setEditingPaymentType("fixed"); }} className={smallBtn} style={secondaryBtnStyle}>Cancel</button>
                              </>
                            ) : canManageData ? (
                              <>
                                <button onClick={() => startEditPayment(payment)} className={smallBtn} style={secondaryBtnStyle}>{actionLabel("edit", "Edit")}</button>
                                <button onClick={() => archivePayment(payment)} className={smallBtn} style={warningBtnStyle}>{actionLabel("archive", "Archive")}</button>
                              </>
                            ) : (
                              <span className="text-gray-500">Vetëm lexim</span>
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
                <SearchableSelect
                  className={input}
                  value={isTeacherUser ? currentTeacherAccount?.name || "" : activeFinanceTeacherFilter}
                  onOpen={() => setSelectedPagaTeacherView(null)}
                  onChange={
                    isTeacherUser
                      ? () => {}
                      : (nextTeacher) => {
                          setSelectedPagaTeacherView(null);
                          setFinanceTeacherFilter(nextTeacher);
                        }
                  }
                  placeholder="Të gjithë mësuesit"
                  disabled={isTeacherUser}
                  options={isTeacherUser
                    ? [{ value: currentTeacherAccount?.name || "", label: currentTeacherAccount?.name || "Mësuesi" }]
                    : [
                        { value: "", label: "Të gjithë mësuesit" },
                        ...sortedTeachersAlpha.map((teacher) => ({ value: teacher.name, label: teacher.name })),
                      ]}
                />
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
                  {sortedTeacherEarnings.map((teacher, index) => {
                    const isSelected = sameId(selectedPagaTeacherView, teacher.id);
                    return (
                      <tr
                        key={teacher.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedPagaTeacherView((prev) => (sameId(prev, teacher.id) ? null : teacher.id));
                        }}
                        className={`${rowHover} cursor-pointer ${isSelected ? selectedRow : ""}`}
                      >
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
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
              <span className="font-semibold" style={{ color: PRIMARY }}>Administrata</span>
              <span className="font-bold">
                {formatCurrency(sortedTeacherEarnings.reduce((sum, teacher) => sum + Number(teacher.adminShare || 0), 0))}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
              <span className="font-semibold" style={{ color: PRIMARY }}>Shkolla</span>
              <span className="font-bold">
                {formatCurrency(sortedTeacherEarnings.reduce((sum, teacher) => sum + Number(teacher.schoolShare || 0), 0))}
              </span>
            </div>

            {selectedPagaTeacherView && (
              <div className="mt-6 border rounded-lg lg:rounded-2xl p-3 sm:p-4 bg-gray-50 border-gray-200">
                <h3 className="text-lg font-bold mb-3" style={{ color: PRIMARY }}>
                  Nxënësit që kanë paguar {selectedPagaTeacher ? `- ${selectedPagaTeacher.name}` : ""}
                </h3>
                <div className={tableWrap}>
                  <table className="min-w-[42rem] w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className={thClass}>Nr</th>
                        <th className={thClass}>Emri</th>
                        <th className={thClass}>Mbiemri</th>
                        <th className={thClass}>Kursi</th>
                        <th className={thClass}>Pagesa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPagaPaidStudents.length > 0 ? (
                        selectedPagaPaidStudents.map((student, index) => (
                          <tr key={student.id} className={rowHover}>
                            <td className={tdClass}>{index + 1}</td>
                            <td className={tdClass}>{student.firstName}</td>
                            <td className={tdClass}>{student.lastName || "-"}</td>
                            <td className={tdClass}>{student.course || "-"}</td>
                            <td className={tdClass}>{formatCurrency(student.amount)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td className={tdClass} colSpan={5}>Ky mësues nuk ka nxënës me pagesë për këtë muaj.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {activeView === "finance" && (
          <div className={`border rounded-lg lg:rounded-2xl shadow-sm ${card} p-3 sm:p-4 space-y-4 lg:space-y-6`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: PRIMARY }}>Financa</h2>
                <p className="text-gray-500">Overview + shpenzimet e shkollës.</p>
              </div>
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[24rem]">
                <input className={dateInput} type="month" value={financeOverviewMonth} onChange={(e) => setFinanceOverviewMonth(e.target.value)} />
                <button onClick={() => setFinanceOverviewMonth("")} className={mainBtn} style={secondaryBtnStyle}>
                  {actionLabel("clear", "Pastro filtrin")}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
              <div className="p-4 rounded-xl border">
                <div className="text-gray-500 text-sm">Të hyrat totale</div>
                <div className="text-xl font-bold">{formatCurrency(overviewIncome)}</div>
              </div>
              <div className="p-4 rounded-xl border">
                <div className="text-gray-500 text-sm">Pagat e mësuesve</div>
                <div className="text-xl font-bold">{formatCurrency(overviewTeacherPay)}</div>
              </div>
              <div className="p-4 rounded-xl border">
                <div className="text-gray-500 text-sm">Administrata</div>
                <div className="text-xl font-bold">{formatCurrency(overviewAdminShare)}</div>
              </div>
              <div className="p-4 rounded-xl border">
                <div className="text-gray-500 text-sm">Shkolla</div>
                <div className="text-xl font-bold">
                  {formatCurrency(
                    overviewSchoolShare
                  )}
                </div>
              </div>
              <div className="p-4 rounded-xl border">
                <div className="text-gray-500 text-sm">Buxheti i shkollës</div>
                <div className="text-xl font-bold">{formatCurrency(overviewProfit)}</div>
              </div>
              <div className="p-4 rounded-xl border">
                <div className="text-gray-500 text-sm">Shpenzimet</div>
                <div className="text-xl font-bold">{formatCurrency(overviewExpenses)}</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium text-white sm:w-64" style={primaryBtnStyle} onClick={() => setIsAllIncomeModalOpen(true)}>
                {actionLabel("information", "Shfaq te gjitha te hyrat")}
              </button>
              <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium text-white sm:w-64" style={secondaryBtnStyle} onClick={openExpenseModal}>{actionLabel("add", "Shto shpenzim")}</button>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <button onClick={exportExpensesExcel} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium text-white sm:w-64" style={secondaryBtnStyle}>{actionLabel("export", "Excel shpenzimet")}</button>
              <button onClick={exportExpensesPdf} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium text-white sm:w-64" style={primaryBtnStyle}>{actionLabel("export", "PDF shpenzimet")}</button>
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
                        <td className={tdClass}>{isEditing ? <DateTextInput className={dateInput} value={editingExpenseDate} onChange={setEditingExpenseDate} /> : formatDateDisplay(expense.date)}</td>
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
                                <button onClick={() => archiveExpense(expense)} className={smallBtn} style={warningBtnStyle}>{actionLabel("archive", "Archive")}</button>
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

            {canManageData && (
            <div className="flex justify-end mb-6">
              <button onClick={() => setIsCourseModalOpen(true)} className={mainBtn} style={primaryBtnStyle}>{actionLabel("add", "Shto kurs")}</button>
            </div>
            )}

            <div className={tableWrap}>
              <table className="min-w-[44rem] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={thClass}>Nr</th>
                    <th className={thClass}>{sortButton("courses", "name", "Emri i kursit")}</th>
                    <th className={thClass}>{sortButton("courses", "pricingType", "Lloji")}</th>
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
                        <td className={tdClass}>{isEditing ? (
                          <SearchableSelect
                            className={input}
                            value={editingCoursePricingType}
                            onChange={setEditingCoursePricingType}
                            placeholder="Lloji"
                            options={pricingTypeOptions}
                          />
                        ) : pricingTypeLabel(course.pricingType)}</td>
                        <td className={tdClass}>{isEditing ? <input className={input} value={editingCoursePrice} onChange={(e) => setEditingCoursePrice(e.target.value)} type="number" min="0" step="0.01" /> : formatCurrency(course.price)}</td>
                        <td className={tdClass}>
                          <div className="flex flex-wrap gap-2">
                            {isEditing ? (
                              <>
                                <button onClick={saveEditCourse} className={smallBtn} style={primaryBtnStyle}>Save</button>
                                <button onClick={() => setEditingCourseId(null)} className={smallBtn} style={secondaryBtnStyle}>Cancel</button>
                              </>
                            ) : canManageData ? (
                              <>
                                <button onClick={() => startEditCourse(course)} className={smallBtn} style={secondaryBtnStyle}>{actionLabel("edit", "Edit")}</button>
                                <button onClick={() => archiveCourse(course)} className={smallBtn} style={warningBtnStyle}>{actionLabel("archive", "Archive")}</button>
                              </>
                            ) : (
                              <span className="text-gray-500">Vetëm lexim</span>
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
                <h2 className="text-2xl font-bold" style={{ color: PRIMARY }}>Arkiva</h2>
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
                <table className="min-w-[42rem] w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className={thClass}>Nr</th>
                      <th className={thClass}>#</th>
                      <th className={thClass}>Emri</th>
                      <th className={thClass}>Email</th>
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
                        <td className={tdClass}>{teacher.email || "-"}</td>
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
                <h3 className="text-lg font-bold" style={{ color: PRIMARY }}>Shpenzime</h3>
                <div className="flex gap-2">
                  <button onClick={() => bulkRestore("expenses")} disabled={!(archiveSelection.expenses || []).length} className={smallBtn} style={(archiveSelection.expenses || []).length ? primaryBtnStyle : disabledPrimaryBtnStyle}>{actionLabel("restore", "Restore Selected")}</button>
                  <button onClick={() => bulkDeleteArchived("expenses")} disabled={!(archiveSelection.expenses || []).length} className={smallBtn} style={(archiveSelection.expenses || []).length ? dangerBtnStyle : { background: "#d1d5db", color: "#6b7280", cursor: "not-allowed" }}>{actionLabel("delete", "Delete Selected")}</button>
                </div>
              </div>
              <div className={tableWrap}>
                <table className="min-w-[44rem] w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className={thClass}>Nr</th>
                      <th className={thClass}>#</th>
                      <th className={thClass}>{sortButton("archiveExpenses", "name", "Produkti")}</th>
                      <th className={thClass}>{sortButton("archiveExpenses", "date", "Data")}</th>
                      <th className={thClass}>{sortButton("archiveExpenses", "amount", "Çmimi")}</th>
                      <th className={thClass}>Shenime</th>
                      <th className={thClass}>Veprimi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedArchiveExpenses.map((expense, index) => (
                      <tr key={expense.id} className={rowHover}>
                        <td className={tdClass}>{index + 1}</td>
                        <td className={tdClass}><input type="checkbox" className={roundCheckbox} checked={(archiveSelection.expenses || []).includes(expense.id)} onChange={() => toggleArchiveSelection("expenses", expense.id)} /></td>
                        <td className={tdClass}>{expense.name}</td>
                        <td className={tdClass}>{formatDateDisplay(expense.date)}</td>
                        <td className={tdClass}>{formatCurrency(expense.amount)}</td>
                        <td className={tdClass}>{expense.note || "-"}</td>
                        <td className={tdClass}>
                          <div className="flex gap-2">
                            <button onClick={() => restoreExpense(expense)} className={smallBtn} style={primaryBtnStyle}>{actionLabel("restore", "Restore")}</button>
                            <button onClick={() => deleteArchivedItem("expenses", expense.id)} className={smallBtn} style={dangerBtnStyle}>{actionLabel("delete", "Delete")}</button>
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
                      <th className={thClass}>{sortButton("courses", "pricingType", "Lloji")}</th>
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
                        <td className={tdClass}>{pricingTypeLabel(course.pricingType)}</td>
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

        {selectedDetailsStudent && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4" onClick={() => setDetailsStudentId(null)}>
            <div className="my-4 w-full max-w-2xl rounded-lg bg-white p-4 sm:p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
              <div>
                <h3 className="text-xl font-bold" style={{ color: PRIMARY }}>Të dhënat e nxënësit</h3>
                <p className="text-sm text-gray-500">{selectedDetailsStudent.name}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 px-3 py-2"><span className="block text-xs text-gray-500">Emri</span><span className="font-medium">{selectedDetailsStudent.firstName || "-"}</span></div>
                <div className="rounded-lg border border-gray-200 px-3 py-2"><span className="block text-xs text-gray-500">Mbiemri</span><span className="font-medium">{selectedDetailsStudent.lastName || "-"}</span></div>
                <div className="rounded-lg border border-gray-200 px-3 py-2"><span className="block text-xs text-gray-500">Mosha</span><span className="font-medium">{selectedDetailsStudent.age || "-"}</span></div>
                <div className="rounded-lg border border-gray-200 px-3 py-2"><span className="block text-xs text-gray-500">Qyteti</span><span className="font-medium">{selectedDetailsStudent.city || "-"}</span></div>
                <div className="rounded-lg border border-gray-200 px-3 py-2"><span className="block text-xs text-gray-500">Telefoni</span><span className="font-medium">{selectedDetailsStudent.phone || "-"}</span></div>
                <div className="rounded-lg border border-gray-200 px-3 py-2"><span className="block text-xs text-gray-500">Emaili</span><span className="font-medium">{selectedDetailsStudent.email || "-"}</span></div>
                <div className="rounded-lg border border-gray-200 px-3 py-2"><span className="block text-xs text-gray-500">Kursi</span><span className="font-medium">{selectedDetailsStudent.course || "-"}</span></div>
                <div className="rounded-lg border border-gray-200 px-3 py-2"><span className="block text-xs text-gray-500">Muaji</span><span className="font-medium">{formatMonthYear(selectedDetailsStudent.group)}</span></div>
                <div className="rounded-lg border border-gray-200 px-3 py-2"><span className="block text-xs text-gray-500">Grupi</span><span className="font-medium">{selectedDetailsStudent.studentGroup || "-"}</span></div>
                <div className="rounded-lg border border-gray-200 px-3 py-2"><span className="block text-xs text-gray-500">Mësuesi</span><span className="font-medium">{selectedDetailsStudent.teacherName || "Pa mësues"}</span></div>
                <div className="rounded-lg border border-gray-200 px-3 py-2"><span className="block text-xs text-gray-500">Statusi</span><span className="font-medium">{enrollmentStatusLabel(selectedDetailsStudent.enrollmentStatus)}</span></div>
                <div className="rounded-lg border border-gray-200 px-3 py-2"><span className="block text-xs text-gray-500">Pagesa</span><span className="font-medium">{isTeacherUser && !sameId(selectedDetailsStudent.teacherId, currentTeacherId) ? "-" : hasStudentCurrentPayment(selectedDetailsStudent) ? "E paguar" : "Pa paguar"}</span></div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setDetailsStudentId(null)} className={smallBtn} style={secondaryBtnStyle}>Close</button>
              </div>
            </div>
          </div>
        )}

        {isEnrollmentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4" onClick={() => setIsEnrollmentModalOpen(false)}>
            <div className="my-4 w-full max-w-5xl rounded-lg bg-white p-4 sm:p-6 shadow-xl space-y-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-bold" style={{ color: PRIMARY }}>
                  Kurset e nxënësit {selectedEnrollmentStudent ? `- ${selectedEnrollmentStudent.name}` : ""}
                </h3>
                <p className="text-sm text-gray-500">
                  Mbaje historikun e kurseve pa e humbur pagesën e vjetër.
                </p>
              </div>

              <div className={tableWrap}>
                <table className="min-w-[60rem] w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className={thClass}>{sortButton("enrollments", "group", "Muaji")}</th>
                      <th className={thClass}>{sortButton("enrollments", "course", "Kursi")}</th>
                      <th className={thClass}>{sortButton("enrollments", "studentGroup", "Grupi")}</th>
                      <th className={thClass}>{sortButton("enrollments", "teacherName", "Mësuesi")}</th>
                      <th className={thClass}>{sortButton("enrollments", "status", "Statusi")}</th>
                      <th className={thClass}>Deri</th>
                      <th className={thClass}>Shënime</th>
                      <th className={thClass}>Veprime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSelectedEnrollmentRows.length > 0 ? (
                      sortedSelectedEnrollmentRows.map((enrollment) => {
                        const teacher = teachers.find((item) => sameId(item.id, enrollment.teacherId));
                        return (
                          <tr key={enrollment.id} className={rowHover}>
                            <td className={tdClass}>{formatMonthYear(enrollment.group)}</td>
                            <td className={tdClass}>{enrollment.course || "-"}</td>
                            <td className={tdClass}>{enrollment.studentGroup || "-"}</td>
                            <td className={tdClass}>{teacher?.name || enrollment.teacherName || "Pa mësues"}</td>
                            <td className={tdClass}>{enrollmentStatusLabel(enrollment.status)}</td>
                            <td className={tdClass}>{formatMonthYear(enrollment.endMonth)}</td>
                            <td className={tdClass}>{enrollment.note || "-"}</td>
                            <td className={tdClass}>
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => startEditEnrollment(enrollment)} className={smallBtn} style={secondaryBtnStyle}>
                                  {actionLabel("edit", "Edit")}
                                </button>
                                {enrollment.status !== "active" && (
                                  <button type="button" onClick={() => updateEnrollmentStatus(enrollment, "active")} className={smallBtn} style={primaryBtnStyle}>
                                    Aktiv
                                  </button>
                                )}
                                {enrollment.status === "active" && (
                                  <button type="button" onClick={() => updateEnrollmentStatus(enrollment, "completed")} className={smallBtn} style={warningBtnStyle}>
                                    Përfundo
                                  </button>
                                )}
                                {enrollment.status !== "inactive" && (
                                  <button type="button" onClick={() => updateEnrollmentStatus(enrollment, "inactive")} className={smallBtn} style={secondaryBtnStyle}>
                                    Joaktiv
                                  </button>
                                )}
                                {canManageData && (
                                  <button type="button" onClick={() => deleteEnrollment(enrollment)} className={smallBtn} style={dangerBtnStyle}>
                                    {actionLabel("delete", "Delete")}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td className={tdClass} colSpan={8}>Ky nxënës ende nuk ka historik kursi.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4">
                <h4 className="mb-3 font-bold" style={{ color: PRIMARY }}>
                  {editingEnrollmentId ? "Ndrysho regjistrimin" : "Shto regjistrim të ri"}
                </h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <SearchableSelect
                    className={input}
                    value={enrollmentForm.course}
                    onChange={(nextValue) => setEnrollmentForm((prev) => ({ ...prev, course: nextValue }))}
                    placeholder="Zgjedh kursin"
                    options={[
                      { value: "", label: "Zgjedh kursin" },
                      ...sortedCoursesAlpha.map((course) => ({ value: course.name, label: course.name })),
                    ]}
                  />
                  <SearchableSelect
                    className={input}
                    value={enrollmentForm.teacherId}
                    onChange={(nextValue) => setEnrollmentForm((prev) => ({ ...prev, teacherId: nextValue }))}
                    placeholder="Pa mësues"
                    options={[
                      { value: "", label: "Pa mësues" },
                      ...sortedTeachersAlpha.map((teacher) => ({ value: teacher.id, label: teacher.name })),
                    ]}
                  />
                  <input className={dateInput} type="month" value={enrollmentForm.group} onChange={(e) => setEnrollmentForm((prev) => ({ ...prev, group: e.target.value }))} aria-label="Muaji" title="Muaji" />
                  <input className={input} value={enrollmentForm.studentGroup} onChange={(e) => setEnrollmentForm((prev) => ({ ...prev, studentGroup: e.target.value }))} placeholder="Grupi (p.sh. gr1)" />
                  <SearchableSelect
                    className={input}
                    value={enrollmentForm.status}
                    onChange={(nextValue) => setEnrollmentForm((prev) => ({ ...prev, status: nextValue }))}
                    placeholder="Statusi"
                    options={enrollmentStatusOptions}
                  />
                  <input className={dateInput} type="month" value={enrollmentForm.endMonth} onChange={(e) => setEnrollmentForm((prev) => ({ ...prev, endMonth: e.target.value }))} aria-label="Deri" title="Deri" disabled={enrollmentForm.status === "active"} />
                  <input className={`${input} md:col-span-2`} value={enrollmentForm.note} onChange={(e) => setEnrollmentForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Shënime" />
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  {editingEnrollmentId && (
                    <button type="button" onClick={() => resetEnrollmentForm(selectedEnrollmentStudent)} className={smallBtn} style={secondaryBtnStyle}>
                      Cancel
                    </button>
                  )}
                  <button type="button" onClick={saveEnrollmentForm} className={smallBtn} style={primaryBtnStyle}>
                    {editingEnrollmentId ? "Save" : "Shto regjistrim"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsEnrollmentModalOpen(false)} className={smallBtn} style={secondaryBtnStyle}>Close</button>
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
                <h3 className="text-xl font-bold" style={{ color: PRIMARY }}>{paymentModalTitle}</h3>
                <p className="text-sm text-gray-500">Zgjedh nxënësin dhe përcakto ndarjen e pagesës.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SearchableSelect
                  className={input}
                  value={selectedStudent}
                  onChange={changePaymentStudent}
                  placeholder="Zgjedh nxënësin"
                  options={[
                    { value: "", label: "Zgjedh nxënësin" },
                    ...sortedStudentsAlpha.map((student) => ({
                      value: student.id,
                      label: studentOptionLabel(student),
                    })),
                  ]}
                />
                {selectedPaymentEnrollmentOptions.length > 1 && (
                  <SearchableSelect
                    className={input}
                    value={selectedPaymentEnrollmentId}
                    onChange={changePaymentEnrollment}
                    placeholder="Zgjedh kursin"
                    options={selectedPaymentEnrollmentOptions.map((enrollment) => ({
                      value: enrollment.id,
                      label: paymentEnrollmentLabel(enrollment),
                    }))}
                  />
                )}
                {isSelectedPaymentHourly && (
                  <>
                    <input className={input} value={paymentHours} onChange={(e) => changePaymentHours(e.target.value)} placeholder="Orët" type="number" min="0" step="0.25" required />
                    <input className={input} value={paymentRate} onChange={(e) => changePaymentRate(e.target.value)} placeholder="Çmimi për orë" type="number" min="0" step="0.01" required />
                  </>
                )}
                <input className={input} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Shuma" />
                <DateTextInput className={dateInput} value={paymentDate} onChange={setPaymentDate} required />
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
                <DateTextInput className={dateInput} value={expenseDate} onChange={setExpenseDate} required />
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
                <div className="md:col-span-2">
                  <SearchableSelect
                    className={input}
                    value={studentForm.course}
                    onChange={(nextValue) => setStudentForm((prev) => ({ ...prev, course: nextValue }))}
                    placeholder="Zgjedh kursin"
                    options={[
                      { value: "", label: "Zgjedh kursin" },
                      ...sortedCoursesAlpha.map((course) => ({ value: course.name, label: course.name })),
                    ]}
                  />
                </div>
                <input className={dateInput} type="month" value={studentForm.group} onChange={(e) => setStudentForm((prev) => ({ ...prev, group: e.target.value }))} aria-label="Muaji" title="Muaji" />
                <input className={input} value={studentForm.studentGroup} onChange={(e) => setStudentForm((prev) => ({ ...prev, studentGroup: e.target.value }))} placeholder="Grupi (p.sh. gr1)" />
                <div className="md:col-span-2">
                  <SearchableSelect
                    className={input}
                    value={studentForm.teacherId}
                    onChange={(nextValue) => setStudentForm((prev) => ({ ...prev, teacherId: nextValue }))}
                    placeholder="Pa mesues"
                    options={[
                      { value: "", label: "Pa mesues" },
                      ...sortedTeachersAlpha.map((teacher) => ({ value: teacher.id, label: teacher.name })),
                    ]}
                  />
                </div>
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
                <input className={`${input} md:col-span-2`} value={teacherForm.email} onChange={(e) => setTeacherForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Emaili i mësuesit" type="email" />
                <div className="md:col-span-2">
                  <SearchableSelect
                    className={input}
                    value={teacherForm.percent}
                    onChange={(nextValue) => setTeacherForm((prev) => ({ ...prev, percent: nextValue }))}
                    placeholder="Përqindja"
                    options={percentOptions.map((percent) => ({ value: percent, label: `${percent}%` }))}
                  />
                </div>
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
                <SearchableSelect
                  className={input}
                  value={courseForm.pricingType}
                  onChange={(nextValue) => setCourseForm((prev) => ({ ...prev, pricingType: nextValue }))}
                  placeholder="Lloji"
                  options={pricingTypeOptions}
                />
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

              <SearchableSelect
                className={input}
                value={assignTeacherId}
                onChange={changeAssignTeacher}
                placeholder="Choose teacher"
                options={[
                  { value: "", label: "Choose teacher" },
                  ...sortedTeachersAlpha.map((teacher) => ({ value: teacher.id, label: teacher.name })),
                ]}
              />

              <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-gray-200">
                {studentsWithEnrollment.some((student) => !student.teacherId || sameId(student.teacherId, assignTeacherId)) ? (
                  sortedStudentsAlpha
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

        {isDuplicateMergeModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4" onClick={() => setIsDuplicateMergeModalOpen(false)}>
            <div className="my-4 w-full max-w-4xl rounded-lg bg-white p-4 sm:p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
              <div>
                <h3 className="text-xl font-bold" style={{ color: PRIMARY }}>Bashko duplikatet</h3>
                <p className="text-sm text-gray-500">Qetu e sheh sakte cili nxenes mbetet kryesor dhe cilat rreshta bashkohen para se ta konfirmosh.</p>
              </div>

              <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                {duplicateMergePreviewGroups.map((preview, index) => {
                  const primaryMeta = duplicateStudentMeta(preview.primaryStudent);
                  return (
                    <div key={`${preview.primaryStudent.id}-${index}`} className="rounded-lg border border-gray-200 p-4 space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-sm text-gray-500">Grupi {index + 1}</div>
                          <div className="text-lg font-semibold text-gray-900">{preview.primaryStudent.name}</div>
                        </div>
                        <span className="inline-flex w-fit items-center rounded-full bg-[#edf4ef] px-3 py-1 text-xs font-semibold text-[#2e2c80]">
                          Ky profil mbetet kryesor
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2 lg:grid-cols-3">
                        <div><span className="font-medium">Kursi:</span> {primaryMeta.course}</div>
                        <div><span className="font-medium">Muaji:</span> {primaryMeta.month}</div>
                        <div><span className="font-medium">Grupi:</span> {primaryMeta.group}</div>
                        <div><span className="font-medium">Mesuesi:</span> {primaryMeta.teacherName}</div>
                        <div><span className="font-medium">Pagesat:</span> {primaryMeta.paymentsCount}</div>
                        <div><span className="font-medium">Regjistrimet:</span> {primaryMeta.enrollmentsCount}</div>
                      </div>

                      {preview.latestEnrollment && (
                        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                          Regjistrimi aktiv pas bashkimit:{" "}
                          {[preview.latestEnrollment.course || "Pa kurs", formatMonthYear(preview.latestEnrollment.group), preview.latestEnrollment.studentGroup || ""]
                            .filter(Boolean)
                            .join(" - ")}
                        </div>
                      )}

                      <div className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-600">
                        Kalojne {preview.movedPayments} pagesa dhe {preview.totalEnrollments} regjistrime gjithsej nen kete profil.
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-700">Rreshtat qe bashkohen</div>
                        {preview.duplicateStudents.map((student) => {
                          const meta = duplicateStudentMeta(student);
                          return (
                            <div key={student.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div className="font-medium text-gray-900">{student.name}</div>
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Arkivohet pas bashkimit</span>
                              </div>
                              <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2 lg:grid-cols-3">
                                <div><span className="font-medium">Kursi:</span> {meta.course}</div>
                                <div><span className="font-medium">Muaji:</span> {meta.month}</div>
                                <div><span className="font-medium">Grupi:</span> {meta.group}</div>
                                <div><span className="font-medium">Mesuesi:</span> {meta.teacherName}</div>
                                <div><span className="font-medium">Pagesat:</span> {meta.paymentsCount}</div>
                                <div><span className="font-medium">Regjistrimet:</span> {meta.enrollmentsCount}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <button type="button" onClick={() => setIsDuplicateMergeModalOpen(false)} className={smallBtn} style={secondaryBtnStyle}>Cancel</button>
                <button type="button" onClick={applyDuplicateStudentMerge} className={smallBtn} style={warningBtnStyle}>Bashko tani</button>
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

              <div className="flex flex-col gap-3">
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
                {canManageData && (
                  <>
                    <input
                      ref={allDataImportRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={importAllData}
                    />
                    <button type="button" onClick={exportAllData} className={`${mainBtn} mt-4`} style={secondaryBtnStyle}>
                      {actionLabel("export", "Eksporto te gjitha")}
                    </button>
                    <button type="button" onClick={() => allDataImportRef.current?.click()} className={mainBtn} style={secondaryBtnStyle}>
                      {actionLabel("import", "Importo te gjitha")}
                    </button>
                    <button type="button" onClick={mergeDuplicateStudents} className={mainBtn} style={warningBtnStyle}>
                      Bashko duplikatet ({duplicateStudentGroups.length})
                    </button>
                  </>
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
