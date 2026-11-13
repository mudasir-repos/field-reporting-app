import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { v4 as uuidv4 } from 'uuid';
import { fetchServerReports } from '../../api/reports-api';
import { CreateReportModal, ReportCard } from '../../components';
import ReportsTabs from '../../components/reports-tab';
import {
  createLocalReport,
  deleteAllLocalReports,
  deleteReportImages,
  getLocalReports,
  retryAllFailedReports,
  retryReport,
} from '../../database/report-repository';
import {
  onQueueChanged,
  startQueueRunner,
  stopQueueRunner,
  wakeQueueRunner,
} from '../../services/queue-runner';
import {
  CreateReportDraft,
  ReportsTab,
  StoredReport,
  UploadStatus,
} from '../../types';
import { formatReportDate } from '../../utils/helper';
import { styles } from './styles';

// Key used by TanStack Query to cache the server reports list.
const SERVER_REPORTS_QUERY_KEY = ['serverReports'];

function ReportsScreen() {
  const [activeTab, setActiveTab] = useState<ReportsTab>('queue');
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Queue tab state — loaded from local SQLite.
  const [queueReports, setQueueReports] = useState<StoredReport[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);

  const queryClient = useQueryClient();

  // ── All Reports tab — fetched from the server via TanStack Query ────────────

  const {
    data: serverReports = [],
    isLoading: isLoadingServer,
    isFetching: isFetchingServer,
    isError: isServerError,
    refetch: refetchServerReports,
  } = useQuery({
    queryKey: SERVER_REPORTS_QUERY_KEY,
    queryFn: fetchServerReports,
    // Don't fetch until the user opens the All Reports tab.
    enabled: activeTab === 'all',
  });

  // ── Queue tab — load from SQLite ────────────────────────────────────────────

  const loadQueueReports = async () => {
    try {
      const reports = await getLocalReports();

      // Uploaded reports are removed from the queue — they belong in All Reports.
      setQueueReports(
        reports.filter(report => report.uploadStatus !== UploadStatus.UPLOADED),
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

  // Load queue once on mount, then subscribe to queue runner events.
  // When an upload succeeds, we also stale the server cache so the
  // All Reports tab automatically re-fetches when opened.
  useEffect(() => {
    loadQueueReports();

    const unsubscribe = onQueueChanged((uploadedSuccessfully: boolean) => {
      // Reload the queue list so statuses (uploading, waiting, failed, uploaded) update in real-time.
      loadQueueReports();

      // If a report just uploaded successfully, mark server cache as stale.
      if (uploadedSuccessfully) {
        queryClient.invalidateQueries({ queryKey: SERVER_REPORTS_QUERY_KEY });
      }
    });

    return unsubscribe;
  }, [queryClient]);

  // ── Create report ───────────────────────────────────────────────────────────

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

      // Reload queue and wake up the runner immediately.
      await loadQueueReports();
      wakeQueueRunner();

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

  // ── Retry actions ───────────────────────────────────────────────────────────

  const handleRetryReport = async (reportId: string) => {
    try {
      await retryReport(reportId);
      wakeQueueRunner();
      await loadQueueReports();
    } catch (error) {
      console.error('Failed to retry report:', error);
      Alert.alert('Retry failed', 'Could not reset the report for retry.');
    }
  };

  const handleRetryAllFailed = async () => {
    try {
      await retryAllFailedReports();
      wakeQueueRunner();
      await loadQueueReports();
    } catch (error) {
      console.error('Failed to retry all failed reports:', error);
      Alert.alert('Retry failed', 'Could not reset failed reports for retry.');
    }
  };

  // ── Reset / Start over ──────────────────────────────────────────────────────

  const handleReset = () => {
    Alert.alert(
      'Start over?',
      'This will delete all locally saved reports and their images. Server data is not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all local data',
          style: 'destructive',
          onPress: confirmReset,
        },
      ],
    );
  };

  const confirmReset = async () => {
    if (isResetting) {
      return;
    }

    try {
      setIsResetting(true);

      // 1. Stop the queue runner so it doesn't process during cleanup.
      await stopQueueRunner();

      // 2. Load all reports so we can delete their image directories.
      const allLocalReports = await getLocalReports();

      // 3. Delete image folders for each report.
      for (const report of allLocalReports) {
        try {
          await deleteReportImages(report.id);
        } catch (deleteError) {
          console.warn(
            `Could not delete images for report ${report.id}:`,
            deleteError,
          );
        }
      }

      // 4. Delete all SQLite rows.
      await deleteAllLocalReports();

      // 5. Clear the queue UI.
      setQueueReports([]);

      // 6. Restart the queue runner (now with an empty database).
      startQueueRunner();

      Alert.alert('Done', 'All local reports have been deleted.');
    } catch (error) {
      console.error('Reset failed:', error);
      Alert.alert('Reset failed', 'Something went wrong. Please try again.');
      startQueueRunner();
    } finally {
      setIsResetting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const isQueueTab = activeTab === 'queue';
  const reportCount = isQueueTab ? queueReports.length : serverReports.length;

  const hasFailedReports = queueReports.some(
    report => report.uploadStatus === UploadStatus.FAILED,
  );

  return (
    <>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.heading}>Reports</Text>

            <Pressable
              style={styles.resetButton}
              onPress={handleReset}
              disabled={isResetting}
            >
              <Text style={styles.resetButtonText}>
                {isResetting ? 'Resetting…' : 'Start over'}
              </Text>
            </Pressable>
          </View>

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

            <View style={styles.sectionRight}>
              {isQueueTab && hasFailedReports && (
                <Pressable
                  style={styles.retryAllButton}
                  onPress={handleRetryAllFailed}
                  accessibilityRole="button"
                  accessibilityLabel="Retry all failed reports"
                >
                  <Text style={styles.retryAllButtonText}>Retry all failed</Text>
                </Pressable>
              )}
              <Text style={styles.count}>{reportCount} reports</Text>
            </View>
          </View>

          {isQueueTab ? (
            isLoadingQueue ? (
              <ActivityIndicator style={styles.loader} color="#2563EB" />
            ) : queueReports.length === 0 ? (
              <QueueEmptyState />
            ) : (
              queueReports.map(report => (
                <ReportCard
                  key={report.id}
                  title={report.description}
                  imageCount={report.imagePaths.length}
                  imagePaths={report.imagePaths}
                  date={formatReportDate(report.createdAt)}
                  uploadStatus={report.uploadStatus}
                  lastError={report.lastError}
                  uploadAttempts={report.uploadAttempts}
                  onRetry={() => handleRetryReport(report.id)}
                />
              ))
            )
          ) : isLoadingServer ? (
            <ActivityIndicator style={styles.loader} color="#2563EB" />
          ) : isServerError ? (
            <ServerErrorState
              onRetry={refetchServerReports}
              isRetrying={isFetchingServer}
            />
          ) : serverReports.length === 0 ? (
            <AllReportsEmptyState />
          ) : (
            serverReports.map(report => (
              <ReportCard
                key={report.id}
                title={report.description}
                imageCount={report.imageUrls.length}
                imageUrls={report.imageUrls}
                date={formatReportDate(report.receivedAt)}
              />
            ))
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

// ── Empty states ─────────────────────────────────────────────────────────────

function QueueEmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>📋</Text>
      <Text style={styles.emptyStateTitle}>No reports in the queue</Text>
      <Text style={styles.emptyStateSubtitle}>
        Tap the + button to create your first field report.
      </Text>
    </View>
  );
}

function AllReportsEmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>🌐</Text>
      <Text style={styles.emptyStateTitle}>No reports on the server yet</Text>
      <Text style={styles.emptyStateSubtitle}>
        Reports you submit will appear here once the server receives them.
      </Text>
    </View>
  );
}

interface ServerErrorStateProps {
  onRetry: () => void;
  isRetrying?: boolean;
}

function ServerErrorState({ onRetry, isRetrying }: ServerErrorStateProps) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>⚠️</Text>
      <Text style={styles.emptyStateTitle}>Could not load reports</Text>
      <Text style={styles.emptyStateSubtitle}>
        Check your connection and try again.
      </Text>
      <Pressable
        style={styles.retryButton}
        onPress={onRetry}
        disabled={isRetrying}
      >
        {isRetrying ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.retryButtonText}>Retry</Text>
        )}
      </Pressable>
    </View>
  );
}

export default ReportsScreen;
