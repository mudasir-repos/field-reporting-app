import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreateReportModal, ReportCard } from '../../components';
import ReportsTabs from '../../components/reports-tab';
import { CreateReportDraft, ReportsTab, UploadStatus } from '../../types';
import { styles } from './styles';

// Temporary mock data
const queueReports = [
  {
    id: '1',
    title: 'Damaged road near main street',
    imageCount: 3,
    date: 'Just now',
    uploadStatus: UploadStatus.PENDING,
  },
  {
    id: '2',
    title: 'Broken street light',
    imageCount: 2,
    date: 'Today, 10:30 AM',
    uploadStatus: UploadStatus.UPLOADING,
  },
  {
    id: '3',
    title: 'Garbage collection issue',
    imageCount: 4,
    date: 'Today, 9:45 AM',
    uploadStatus: UploadStatus.FAILED,
  },
  {
    id: '4',
    title: 'Damaged sidewalk',
    imageCount: 2,
    date: 'Yesterday',
    uploadStatus: UploadStatus.WAITING,
  },
];

const allReports = [
  {
    id: '101',
    title: 'Road maintenance issue',
    imageCount: 3,
    date: 'Yesterday',
    reviewStatus: 'Under review',
  },
  {
    id: '102',
    title: 'Water leakage',
    imageCount: 2,
    date: 'Nov 2, 2026',
    reviewStatus: 'Approved',
  },
  {
    id: '103',
    title: 'Damaged public property',
    imageCount: 4,
    date: 'Nov 1, 2026',
    reviewStatus: 'Rejected',
  },
];

function ReportsScreen() {
  const [activeTab, setActiveTab] = useState<ReportsTab>('queue');
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

  const isQueueTab = activeTab === 'queue';

  return (
    <>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.heading}>Reports</Text>

          <Text style={styles.subtitle}>Manage your field reports</Text>
        </View>

        <ReportsTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {isQueueTab ? 'Pending uploads' : 'Submitted reports'}
            </Text>

            <Text style={styles.count}>
              {isQueueTab
                ? `${queueReports.length} reports`
                : `${allReports.length} reports`}
            </Text>
          </View>

          {isQueueTab
            ? queueReports.map(report => (
                <ReportCard key={report.id} {...report} />
              ))
            : allReports.map(report => (
                <ReportCard key={report.id} {...report} />
              ))}
        </ScrollView>

        {activeTab === 'queue' && (
          <Pressable
            style={styles.fab}
            onPress={() => setIsCreateModalVisible(true)}
          >
            <Text style={styles.fabText}>＋</Text>
          </Pressable>
        )}
      </SafeAreaView>

      <CreateReportModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onSubmit={(report: CreateReportDraft) => {
          console.log('Validated report:', report);
        }}
      />
    </>
  );
}

export default ReportsScreen;
