export interface Student {
  id: string;
  studentCode: string;
  name: string;
  guardianName: string;
  contact: string;
  classGrade: string;
  enrollmentDate: string;
  status: "active" | "inactive";
}

export interface FeeStructure {
  id: string;
  classGrade: string;
  feeType: "tuition" | "registration";
  amount: number;
}

export interface Payment {
  id: string;
  studentId: string;
  feeType: "tuition" | "registration";
  amountPaid: number;
  date: string;
  feeMonth: string;
  receiptNumber: string;
  notes: string;
  collectedBy: string | null;
  paymentMode: string;
  receiptPrinted: boolean;
}

export interface StudentPaymentSubmission {
  id: string;
  feeMonth: string;
  amountSubmitted: number;
  totalCollectedAtSubmission: number;
  previouslySubmittedAmount: number;
  remainingAfterSubmission: number;
  submissionDate: string;
  paymentMode: string;
  notes: string;
  submittedBy: string | null;
  createdAt: string;
}

export interface Teacher {
  id: string;
  name: string;
  contact: string;
  cnic: string;
  joiningDate: string;
  status: "active" | "inactive";
  monthlySalary: number;
}

export interface TeacherLoan {
  id: string;
  teacherId: string;
  amount: number;
  remaining: number;
  dateIssued: string;
  notes: string;
  status: "active" | "paid";
  repaymentType: "specific_month" | "percentage" | "custom_amount" | "manual";
  repaymentMonth: string | null;
  repaymentPercentage: number | null;
  repaymentAmount: number | null;
}

export interface TeacherSalary {
  id: string;
  teacherId: string;
  month: string;
  baseSalary: number;
  loanDeduction: number;
  otherDeduction: number;
  netPaid: number;
  datePaid: string;
  notes: string;
  paymentMode: "cash" | "online";
  receiptUrl: string;
  customAmount: number;
}

export interface TeacherAttendance {
  id: string;
  teacherId: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  notes: string;
}

export const CLASS_GRADES = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Hifz Program",
  "Alim Course",
];
