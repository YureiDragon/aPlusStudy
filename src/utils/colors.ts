export const DOMAIN_COLORS: Record<string, string> = {
  // Core 1
  '1.0': '#3B82F6', // blue - Mobile Devices
  '2.0': '#8B5CF6', // purple - Networking
  '3.0': '#F59E0B', // amber - Hardware
  '4.0': '#06B6D4', // cyan - Virtualization
  '5.0': '#EF4444', // red - Troubleshooting
  // Core 2 (prefix with exam to avoid domain ID collision)
  'c2-1.0': '#10B981', // emerald - Operating Systems
  'c2-2.0': '#F97316', // orange - Security
  'c2-3.0': '#EC4899', // pink - Software Troubleshooting
  'c2-4.0': '#6366F1', // indigo - Operational Procedures
};

export function getDomainColor(domainId: string, exam: string): string {
  const key = exam === 'Core 2' ? `c2-${domainId}` : domainId;
  return DOMAIN_COLORS[key] || '#6B7280';
}
