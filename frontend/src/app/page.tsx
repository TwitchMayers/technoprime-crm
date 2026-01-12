'use client';

import ProtectedRoute from '@/components/ProtectedRoute';

export default function DashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'SUPER_ADMIN', 'TECHNICAL_SPECIALIST']}>
      {/* Ваш контент дашборда */}
      <div>Dashboard Content</div>
    </ProtectedRoute>
  );
}