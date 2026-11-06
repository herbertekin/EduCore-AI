
import { useState } from 'react';
import {
  UserPlus,
  Users,
  ClipboardList,
} from 'lucide-react';

import TeacherRegistration from './TeacherRegistration';
import TeacherAssignmentManagement from './TeacherAssignmentManagement';
import TeacherDirectory from './TeacherDirectory';

type Props = {
  schoolId: string;
};

type Tab = 'register' | 'directory' | 'assignments';

export default function TeacherManagement({ schoolId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('register');

  const tabClass = (tab: Tab) =>
    `flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${
      activeTab === tab
        ? 'border-emerald-600 text-emerald-700'
        : 'border-transparent text-slate-500 hover:text-slate-800'
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Teacher Management
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Register staff, manage login access, and assign classes and subjects.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('register')}
          className={tabClass('register')}
        >
          <UserPlus size={18} />
          Register Teacher
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          className={tabClass('directory')}
        >
          <Users size={18} />
          Teacher Directory
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('assignments')}
          className={tabClass('assignments')}
        >
          <ClipboardList size={18} />
          Manage Assignments
        </button>
      </div>

      <div>
        {activeTab === 'register' && (
          <TeacherRegistration schoolId={schoolId} />
        )}

        {activeTab === 'directory' && (
          <TeacherDirectory schoolId={schoolId} />
        )}

        {activeTab === 'assignments' && (
          <TeacherAssignmentManagement schoolId={schoolId} />
        )}
      </div>
    </div>
  );
}
