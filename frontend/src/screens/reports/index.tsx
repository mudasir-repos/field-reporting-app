import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { v4 as uuidv4 } from 'uuid';
import { CreateReportModal, ReportCard } from '../../components';
import ReportsTabs from '../../components/reports-tab';
import {
  createLocalReport,
  getLocalReports,
} from '../../database/report-repository';
import {
  CreateReportDraft,
  ReportsTab,
  StoredReport,
  UploadStatus,
} from '../../types';
import { styles } from './styles';
import { formatReportDate } from '../../utils/helper';

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
  const [isSaving, setIsSaving] = useState(false);
  const [queueReports, setQueueReports] = useState<StoredReport[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);

  const isQueueTab = activeTab === 'queue';

  useEffect(() => {
    loadQueueReports();
  }, []);

  const loadQueueReports = async () => {
    try {
      const reports = await getLocalReports();

      // Uploaded reports no longer belong in the pending upload queue.
      setQueueReports(
        reports.filter(report => report.uploadStatus !== 'uploaded'),
      );
    } catch (error) {
      console.error('Failed to load reports from SQLite:', error);

      Alert.alert(
        'Unable to load reports',
        'Something went wrong while loading your saved reports.',
      );
    } finally {
      setIsLoadingQueue(false);
    }
  };

  const handleCreateReport = async (report: CreateReportDraft) => {
    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      await createLocalReport({
        id: uuidv4(),
        description: report.description,
        images: report.images,
      });
      await loadQueueReports();

      setIsCreateModalVisible(false);

      Alert.alert(
        'Report saved',
        'Your report has been saved locally and is waiting to upload.',
      );
    } catch (error) {
      console.error('Failed to save report:', error);

      Alert.alert(
        'Unable to save report',
        'Your report could not be saved. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

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

          {isQueueTab ? (
            isLoadingQueue ? (
              <Text>Loading reports...</Text>
            ) : queueReports.length === 0 ? (
              <Text>No reports saved yet.</Text>
            ) : (
              queueReports.map(report => (
                <ReportCard
                  key={report.id}
                  title={report.description}
                  imageCount={report.imagePaths.length}
                  imagePaths={report.imagePaths}
                  date={formatReportDate(report.createdAt)}
                  uploadStatus={report.uploadStatus as UploadStatus}
                />
              ))
            )
          ) : (
            allReports.map(report => <ReportCard key={report.id} {...report} />)
          )}
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
        isSaving={isSaving}
        onClose={() => setIsCreateModalVisible(false)}
        onSubmit={handleCreateReport}
      />
    </>
  );
}

export default ReportsScreen;
