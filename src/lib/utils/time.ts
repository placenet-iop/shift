export type EventRecord = {
	event_type: 'in' | 'out' | 'pause_start' | 'pause_end';
	ts: string;
};

export type WeeklySummary = {
	weekStart: string;
	weekEnd: string;
	totalHours: number;
};

function startOfWeek(date: Date): Date {
	const result = new Date(date);
	result.setHours(0, 0, 0, 0);
	const day = result.getDay(); // 0 (Sun) - 6 (Sat)
	const diff = (day + 6) % 7; // shift so Monday is 0
	result.setDate(result.getDate() - diff);
	return result;
}

function endOfWeek(weekStart: Date): Date {
	const result = new Date(weekStart);
	result.setDate(result.getDate() + 6);
	result.setHours(23, 59, 59, 999);
	return result;
}

export function calculateWeeklySummaries(events: EventRecord[]): WeeklySummary[] {
	if (!events.length) return [];

	const eventsAscending = [...events].sort(
		(a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
	);

	let currentIn: Date | null = null;
	let accumulatedBreakMs = 0;
	let activeBreakStart: Date | null = null;

	const weeklyTotals = new Map<
		string,
		{ start: Date; end: Date; totalMs: number }
	>();

	const addWorkedTime = (endTime: Date) => {
		if (!currentIn) return;

		if (activeBreakStart) {
			accumulatedBreakMs += endTime.getTime() - activeBreakStart.getTime();
			activeBreakStart = null;
		}

		const workedMs = endTime.getTime() - currentIn.getTime() - accumulatedBreakMs;
		if (workedMs > 0) {
			const weekStart = startOfWeek(endTime);
			const key = weekStart.toISOString();
			const week = weeklyTotals.get(key) || {
				start: weekStart,
				end: endOfWeek(weekStart),
				totalMs: 0
			};
			week.totalMs += workedMs;
			weeklyTotals.set(key, week);
		}

		currentIn = null;
		accumulatedBreakMs = 0;
	};

	for (const event of eventsAscending) {
		const timestamp = new Date(event.ts);

		switch (event.event_type) {
			case 'in': {
				currentIn = timestamp;
				accumulatedBreakMs = 0;
				activeBreakStart = null;
				break;
			}
			case 'pause_start': {
				if (currentIn && !activeBreakStart) {
					activeBreakStart = timestamp;
				}
				break;
			}
			case 'pause_end': {
				if (currentIn && activeBreakStart) {
					accumulatedBreakMs += timestamp.getTime() - activeBreakStart.getTime();
					activeBreakStart = null;
				}
				break;
			}
			case 'out': {
				addWorkedTime(timestamp);
				break;
			}
		}
	}

	return Array.from(weeklyTotals.values())
		.map((week) => ({
			weekStart: week.start.toISOString(),
			weekEnd: week.end.toISOString(),
			totalHours: week.totalMs / (1000 * 60 * 60)
		}))
		.sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());
}

