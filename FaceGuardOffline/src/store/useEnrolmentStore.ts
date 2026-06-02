import { create } from 'zustand';
import { Employee, EnrolmentData, VaultManager } from '../modules/BiometricVault/VaultManager';
import { FaceQualityReport } from '../modules/FaceEngine/FaceCropper';
import { Logger } from '../utils/logger';
import { useAppStore } from './useAppStore';

export type EnrolmentStep = 0 | 1 | 2 | 3;

export interface EmployeeFormData {
  name: string;
  employee_code: string;
  designation: string;
  department: string;
  enrolled_by: string;
  device_id: string;
}

export interface EnrolmentStoreState {
  step: EnrolmentStep;
  employeeForm: Partial<EmployeeFormData>;
  capturedEmbeddings: number[][];
  captureQuality: FaceQualityReport[];
  isCapturing: boolean;
  isFinalising: boolean;
  error: string | null;
  nextStep: () => void;
  prevStep: () => void;
  setField: <K extends keyof EmployeeFormData>(field: K, value: EmployeeFormData[K]) => void;
  addCapture: (embedding: number[], quality: FaceQualityReport) => void;
  setCapturing: (capturing: boolean) => void;
  finalise: () => Promise<Employee>;
  reset: () => void;
}

const initialState = {
  step: 0 as EnrolmentStep,
  employeeForm: {},
  capturedEmbeddings: [],
  captureQuality: [],
  isCapturing: false,
  isFinalising: false,
  error: null,
};

export const useEnrolmentStore = create<EnrolmentStoreState>((set, get) => ({
  ...initialState,

  nextStep: () => set((state) => ({ step: Math.min(state.step + 1, 3) as EnrolmentStep })),

  prevStep: () => set((state) => ({ step: Math.max(state.step - 1, 0) as EnrolmentStep })),

  setField: (field, value) => {
    set((state) => ({
      employeeForm: {
        ...state.employeeForm,
        [field]: value,
      },
      error: null,
    }));
  },

  addCapture: (embedding, quality) => {
    set((state) => ({
      capturedEmbeddings: [...state.capturedEmbeddings, embedding],
      captureQuality: [...state.captureQuality, quality],
      error: null,
    }));
  },

  setCapturing: (capturing) => set({ isCapturing: capturing }),

  finalise: async () => {
    const { employeeForm, capturedEmbeddings } = get();
    if (!employeeForm.name || !employeeForm.employee_code) {
      const error = 'Name and employee code are required.';
      set({ error });
      throw new Error(error);
    }
    if (capturedEmbeddings.length < 3) {
      const error = 'Capture front, left, and right face embeddings before finalising.';
      set({ error });
      throw new Error(error);
    }

    set({ isFinalising: true, error: null });
    try {
      const data: EnrolmentData = {
        name: employeeForm.name,
        employee_code: employeeForm.employee_code,
        designation: employeeForm.designation,
        department: employeeForm.department,
        enrolled_by: employeeForm.enrolled_by,
        device_id: employeeForm.device_id,
      };
      const employee = await VaultManager.getInstance().enrollEmployee(data, capturedEmbeddings);
      await useAppStore.getState().refreshEmployees();
      Logger.info('EnrolmentStore', 'Employee enrolled locally', {
        employeeId: employee.id,
        employeeCode: employee.employee_code,
      });
      set({ ...initialState });
      return employee;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ error: message, isFinalising: false });
      Logger.error('EnrolmentStore', 'Finalise enrolment failed', { error: message });
      throw error;
    }
  },

  reset: () => set({ ...initialState }),
}));

export default useEnrolmentStore;
