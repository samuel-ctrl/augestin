import { useState } from "react";
import {
  LoadingSpinner,
  EmptyState,
  ConfirmDialog,
  ProgressBar,
  SubjectCard,
  BookCard,
  CredentialCard,
  FileUpload,
  IconPicker,
  Breadcrumb,
  ErrorToast,
  Toast,
  useToast,
  DataTable,
  TableSearch,
  TablePagination,
} from "@shared";
import type { ColumnDef, PaginatedResponse, TableQueryParams } from "@shared";
import SubjectForm from "../components/SubjectForm";

interface SampleRow {
  id: string;
  name: string;
  status: string;
  created: string;
}

const sampleColumns: ColumnDef<SampleRow>[] = [
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
  { key: "created", label: "Created" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-lg font-semibold text-gray-800 mb-1 border-b border-gray-200 pb-2">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="p-4 border border-gray-200 rounded-lg bg-white">
        {children}
      </div>
    </div>
  );
}

export default function DevComponents() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDangerConfirm, setShowDangerConfirm] = useState(false);
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [iconValue, setIconValue] = useState("book");
  const [fileValue, setFileValue] = useState<File | null>(null);
  const { toast, showError, showSuccess, showInfo, dismiss } = useToast();

  const sampleFetch = async (
    _params: TableQueryParams
  ): Promise<PaginatedResponse<SampleRow>> => {
    return {
      items: [
        { id: "1", name: "Alice Johnson", status: "Active", created: "2024-01-15" },
        { id: "2", name: "Bob Smith", status: "Inactive", created: "2024-02-20" },
        { id: "3", name: "Charlie Brown", status: "Active", created: "2024-03-10" },
      ],
      total: 3,
      page: 1,
      page_size: 20,
      total_pages: 1,
    };
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Component Library</h1>
        <p className="text-sm text-gray-500 mt-1">
          All shared UI components and tutor portal components for development reference.
        </p>
      </div>

      {/* ===== UI PRIMITIVES ===== */}
      <Section title="UI Primitives">
        <SubSection title="LoadingSpinner">
          <div className="flex items-center gap-8">
            <div className="text-center">
              <LoadingSpinner size="sm" />
              <p className="text-xs text-gray-400 mt-2">size="sm"</p>
            </div>
            <div className="text-center">
              <LoadingSpinner size="md" />
              <p className="text-xs text-gray-400 mt-2">size="md"</p>
            </div>
            <div className="text-center">
              <LoadingSpinner size="lg" />
              <p className="text-xs text-gray-400 mt-2">size="lg"</p>
            </div>
          </div>
        </SubSection>

        <SubSection title="ProgressBar">
          <div className="space-y-3 max-w-sm">
            <div>
              <p className="text-xs text-gray-400 mb-1">0%</p>
              <ProgressBar percentage={0} showLabel />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">45%</p>
              <ProgressBar percentage={45} showLabel />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">90% (completed)</p>
              <ProgressBar percentage={90} showLabel />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">100%</p>
              <ProgressBar percentage={100} showLabel />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">size="sm" 60%</p>
              <ProgressBar percentage={60} size="sm" />
            </div>
          </div>
        </SubSection>

        <SubSection title="EmptyState">
          <div className="grid grid-cols-2 gap-4">
            <EmptyState
              title="No items found"
              description="Try adjusting your search or filters."
            />
            <EmptyState
              icon={<span className="text-2xl">+</span>}
              title="Get started"
              description="Create your first item to begin."
              action={{ label: "Create Item", onClick: () => alert("Clicked!") }}
            />
          </div>
        </SubSection>

        <SubSection title="ConfirmDialog">
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirm(true)}
              className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
            >
              Default Dialog
            </button>
            <button
              onClick={() => setShowDangerConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
            >
              Danger Dialog
            </button>
          </div>
          <ConfirmDialog
            open={showConfirm}
            title="Confirm Action"
            message="Are you sure you want to proceed with this action?"
            onConfirm={() => setShowConfirm(false)}
            onCancel={() => setShowConfirm(false)}
          />
          <ConfirmDialog
            open={showDangerConfirm}
            title="Delete Item"
            message="This action cannot be undone. All data will be permanently deleted."
            confirmLabel="Delete"
            variant="danger"
            onConfirm={() => setShowDangerConfirm(false)}
            onCancel={() => setShowDangerConfirm(false)}
          />
        </SubSection>
      </Section>

      {/* ===== TOAST NOTIFICATIONS ===== */}
      <Section title="Toast Notifications">
        <SubSection title="Toast (new)">
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => showError("A student with email 'john@test.com' already exists.")}
              className="px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200"
            >
              Error Toast
            </button>
            <button
              onClick={() => showSuccess("Student created successfully.")}
              className="px-3 py-1.5 bg-green-100 text-green-700 text-sm rounded-lg hover:bg-green-200"
            >
              Success Toast
            </button>
            <button
              onClick={() => showInfo("Your session will expire in 5 minutes.")}
              className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm rounded-lg hover:bg-blue-200"
            >
              Info Toast
            </button>
          </div>
        </SubSection>

        <SubSection title="ErrorToast (legacy)">
          <button
            onClick={() => setShowErrorToast(true)}
            className="px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200"
          >
            Show ErrorToast
          </button>
          {showErrorToast && (
            <ErrorToast
              message="Something went wrong. Please try again."
              onDismiss={() => setShowErrorToast(false)}
            />
          )}
        </SubSection>
      </Section>

      {/* ===== CONTENT COMPONENTS ===== */}
      <Section title="Content Components">
        <SubSection title="SubjectCard">
          <div className="grid grid-cols-3 gap-4">
            <SubjectCard
              name="Mathematics"
              icon="calculator"
              bookCount={12}
              onClick={() => {}}
            />
            <SubjectCard
              name="Physics"
              icon="atom"
              bookCount={8}
              onClick={() => {}}
              actions={
                <div className="flex gap-1">
                  <button className="text-xs text-gray-400 hover:text-gray-600">Edit</button>
                  <button className="text-xs text-red-400 hover:text-red-600">Delete</button>
                </div>
              }
            />
            <SubjectCard
              name="Biology"
              icon="dna"
              bookCount={0}
              onClick={() => {}}
            />
          </div>
        </SubSection>

        <SubSection title="BookCard">
          <div className="grid grid-cols-3 gap-4">
            <BookCard
              title="Algebra Basics"
              standard="5"
              onClick={() => {}}
            />
            <BookCard
              title="Trigonometry"
              standard="10"
              onClick={() => {}}
            />
            <BookCard
              title="Calculus"
              standard="12"
              onClick={() => {}}
              actions={
                <div className="flex gap-1">
                  <button className="text-xs text-primary-500 hover:text-primary-700">Assign</button>
                  <button className="text-xs text-red-400 hover:text-red-600">Delete</button>
                </div>
              }
            />
          </div>
        </SubSection>

        <SubSection title="CredentialCard">
          <div className="max-w-sm">
            <CredentialCard loginId="student@test.com" password="Stu@AbC1" />
          </div>
        </SubSection>
      </Section>

      {/* ===== FORM COMPONENTS ===== */}
      <Section title="Form Components">
        <SubSection title="IconPicker">
          <div className="max-w-xs">
            <p className="text-xs text-gray-400 mb-2">Selected: {iconValue}</p>
            <IconPicker value={iconValue} onChange={setIconValue} />
          </div>
        </SubSection>

        <SubSection title="FileUpload">
          <div className="max-w-sm">
            <FileUpload
              label="Upload Image"
              accept=".jpg,.jpeg,.png,.webp"
              maxSizeMB={5}
              value={fileValue}
              onChange={setFileValue}
            />
          </div>
        </SubSection>

        <SubSection title="SubjectForm (Tutor Component)">
          <button
            onClick={() => setShowSubjectForm(true)}
            className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
          >
            Open Subject Form
          </button>
          <SubjectForm
            open={showSubjectForm}
            title="Create Subject"
            onSubmit={(data) => {
              alert(`Name: ${data.name}, Icon: ${data.icon}`);
              setShowSubjectForm(false);
            }}
            onCancel={() => setShowSubjectForm(false)}
          />
        </SubSection>
      </Section>

      {/* ===== NAVIGATION ===== */}
      <Section title="Navigation Components">
        <SubSection title="Breadcrumb">
          <Breadcrumb
            segments={[
              { label: "Home", path: "/" },
              { label: "Self-Study", path: "/self-study" },
              { label: "Mathematics" },
            ]}
          />
        </SubSection>
      </Section>

      {/* ===== DATA TABLE ===== */}
      <Section title="Data Display">
        <SubSection title="DataTable">
          <DataTable<SampleRow>
            fetchFn={sampleFetch}
            columns={sampleColumns}
            searchPlaceholder="Search..."
            defaultSortBy="name"
            rowKey={(r) => r.id}
          />
        </SubSection>
      </Section>
    </div>
  );
}
