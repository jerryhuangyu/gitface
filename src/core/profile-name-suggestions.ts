function normalizeName(value: string): string {
	return value.trim().toLowerCase();
}

function damerauLevenshteinDistance(a: string, b: string): number {
	if (a === b) {
		return 0;
	}

	if (a.length === 0) {
		return b.length;
	}

	if (b.length === 0) {
		return a.length;
	}

	const rows = a.length + 1;
	const cols = b.length + 1;
	const matrix = Array.from({ length: rows }, (_, rowIndex) =>
		Array.from({ length: cols }, (_, colIndex) =>
			rowIndex === 0 ? colIndex : colIndex === 0 ? rowIndex : 0,
		),
	);

	for (let i = 1; i < rows; i += 1) {
		for (let j = 1; j < cols; j += 1) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			matrix[i][j] = Math.min(
				(matrix[i][j - 1] ?? Number.POSITIVE_INFINITY) + 1,
				(matrix[i - 1][j] ?? Number.POSITIVE_INFINITY) + 1,
				(matrix[i - 1][j - 1] ?? Number.POSITIVE_INFINITY) + cost,
			);

			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				matrix[i][j] = Math.min(
					matrix[i][j] ?? Number.POSITIVE_INFINITY,
					(matrix[i - 2][j - 2] ?? Number.POSITIVE_INFINITY) + 1,
				);
			}
		}
	}

	return matrix[a.length]?.[b.length] ?? Math.max(a.length, b.length);
}

export function suggestProfileNames(
	inputName: string,
	candidateNames: string[],
	limit = 3,
): string[] {
	const query = normalizeName(inputName);
	if (!query || limit <= 0) {
		return [];
	}

	const ranked = Array.from(new Set(candidateNames))
		.map((candidateName) => {
			const normalizedCandidate = normalizeName(candidateName);
			const exactCaseInsensitive = normalizedCandidate === query ? 1 : 0;
			const isPrefix = normalizedCandidate.startsWith(query) ? 1 : 0;
			const isSubstring = normalizedCandidate.includes(query) ? 1 : 0;
			const distance = damerauLevenshteinDistance(query, normalizedCandidate);
			const lengthDelta = Math.abs(normalizedCandidate.length - query.length);

			return {
				candidateName,
				exactCaseInsensitive,
				isPrefix,
				isSubstring,
				distance,
				lengthDelta,
			};
		})
		.sort((a, b) => {
			if (a.exactCaseInsensitive !== b.exactCaseInsensitive) {
				return b.exactCaseInsensitive - a.exactCaseInsensitive;
			}
			if (a.isPrefix !== b.isPrefix) {
				return b.isPrefix - a.isPrefix;
			}
			if (a.isSubstring !== b.isSubstring) {
				return b.isSubstring - a.isSubstring;
			}
			if (a.distance !== b.distance) {
				return a.distance - b.distance;
			}
			if (a.lengthDelta !== b.lengthDelta) {
				return a.lengthDelta - b.lengthDelta;
			}
			return a.candidateName.localeCompare(b.candidateName);
		});

	return ranked.slice(0, limit).map((item) => item.candidateName);
}
