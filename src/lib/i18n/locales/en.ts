export default {
	common: {
		appName: 'Shift',
		subtitle: 'Work Time Tracking System',
		loading: 'Loading...',
		error: 'Error',
		success: 'Success',
		search: 'Search',
		clear: 'Clear',
		back: 'Back',
		backToHome: '← Back to home',
		save: 'Save',
		cancel: 'Cancel',
		close: 'Close',
		accept: 'Accept',
		yes: 'Yes',
		no: 'No',
		all: 'All',
		none: 'None',
		actions: 'Actions',
		view: 'View',
		edit: 'Edit',
		delete: 'Delete',
		export: 'Export',
		import: 'Import',
		filter: 'Filter',
		filters: 'Filters',
		clearFilters: 'Clear Filters',
		noResults: 'No results found',
		connectionError: 'Connection error',
		unknownError: 'An unknown error occurred'
	},
	auth: {
		restrictedAccess: 'Restricted Access',
		restrictedMessage: 'This application is only accessible from Placenet.',
		restrictedInfo: "If you're seeing this message, you need to access through your Placenet account.",
		devNotice: 'Development/Testing:',
		devInfo: 'For local testing, you can generate a token using the development endpoint:',
		devLink: 'Go to Development Token Generator →',
		devManual: 'Or manually set a token in the console:',
		tokenPlaceholder: 'YOUR_JWT_TOKEN'
	},
	status: {
		currentStatus: 'Current Status',
		clockedOut: 'Clocked Out',
		clockedIn: 'Clocked In',
		onBreak: 'On Break',
		working: 'Working',
		inactive: 'Inactive',
		lastRecord: 'Last record:',
		noRecords: 'No records yet'
	},
	buttons: {
		clockIn: 'Clock In',
		clockOut: 'Clock Out',
		startBreak: 'Start Break',
		resumeWork: 'Resume Work',
		viewHistory: 'View History',
		adminPanel: 'Admin Panel',
		exportCSV: 'Export CSV',
		exportJSON: 'Export JSON',
		search: 'Search',
		loading: 'Loading...'
	},
	messages: {
		timeRecorded: 'Time record registered successfully',
		failedToClock: 'Failed to clock',
		failedToLoadStatus: 'Failed to load status',
		failedToLoadEvents: 'Failed to load events',
		failedToLoadUsers: 'Failed to load users',
		exportFailed: 'Export failed',
		exportError: 'Export error',
		noAdminPermissions: 'You do not have administrator permissions'
	},
	privacy: {
		title: 'Data Protection Information',
		welcome: 'Welcome to the Digital Time Tracking System. In accordance with the General Data Protection Regulation (GDPR), we inform you about the processing of your personal data:',
		whatData: 'What data do we collect?',
		dataList: {
			identification: 'Identification: name and email',
			timeRecords: 'Time records: clock in, clock out, and breaks with exact date/time',
			technical: 'Technical information: device and IP address'
		},
		whatFor: 'What for?',
		whatForText: 'To comply with the legal obligation of time tracking (Royal Decree-Law 8/2019). Your consent is not required as this is a legal obligation.',
		yourRights: 'Your rights',
		rightsText: 'You can exercise your rights to:',
		rightsList: {
			access: 'Access: View your time records in "View History"',
			rectification: 'Rectification: Request correction of inaccurate data',
			portability: 'Portability: Obtain a copy of your data'
		},
		importantNote: 'Records are kept for 4 years and are immutable to ensure transparency and legal compliance.',
		viewFullPolicy: 'View Full Policy',
		readAndUnderstand: 'I have read and understand'
	},
	admin: {
		title: 'Admin Panel',
		subtitle: 'Time Tracking - Shift',
		tabs: {
			timeRecords: 'Time Records',
			users: 'Users'
		},
		filters: {
			searchFilters: 'Search Filters',
			viewFilters: 'View Filters',
			user: 'User:',
			allUsers: 'All users',
			from: 'From:',
			to: 'To:',
			eventType: 'Event Type:',
			allEvents: 'All events',
			domain: 'Domain:',
			allDomains: 'All domains'
		},
		events: {
			loadingRecords: 'Loading records...',
			noRecords: 'No records found in the selected period',
			totalRecords: 'Total records',
			showing: 'Showing',
			users: 'Users',
			domains: 'Domains',
			tableHeaders: {
				worker: 'Worker',
				type: 'Type',
				dateTime: 'Date and Time',
				domainId: 'Domain ID',
				domain: 'Domain'
			}
		},
		users: {
			title: 'User Management',
			total: 'Total:',
			active: 'Active:',
			admins: 'Admins:',
			tableHeaders: {
				user: 'User',
				roleStatus: 'Role / Status',
				domain: 'Domain',
				activity: 'Activity (30 days)',
				lastRecord: 'Last Record',
				registered: 'Registered'
			},
			roles: {
				admin: 'Admin',
				worker: 'Worker'
			},
			status: {
				active: 'Active',
				inactive: 'Inactive'
			},
			stats: {
				total: 'Total:',
				clockIns: 'Clock Ins:',
				clockOuts: 'Clock Outs:'
			},
			noRecords: 'No records',
			loading: 'Loading...'
		}
	},
	history: {
		title: 'Time Records History',
		from: 'From:',
		to: 'To:',
		loadingRecords: 'Loading records...',
		noRecords: 'No records found in the selected period',
		totalRecords: 'Total records:',
		worker: 'Worker:',
		domain: 'Domain:',
		weeklySummary: 'Weekly hours overview'
	},
	events: {
		clockIn: 'Clock In',
		clockOut: 'Clock Out',
		breakStart: 'Break Start',
		breakEnd: 'Break End'
	},
	legal: {
		privacyPolicy: 'Privacy Policy',
		legalNotice: 'Legal Notice'
	},
	language: {
		english: 'English',
		spanish: 'Español',
		selectLanguage: 'Select Language'
	}
};

