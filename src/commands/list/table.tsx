/** biome-ignore-all lint/suspicious/noExplicitAny: <generic> */
import { Box, Text } from "ink";
import React from "react";
import stringWidth from "string-width";

export type Scalar = string | number | boolean | null | undefined;
export type ScalarDict = { [key: string]: Scalar };

export type CellProps = React.PropsWithChildren<{ column: number }>;

export interface TableProps<T extends ScalarDict> {
	data: T[];
	columns?: (keyof T)[];
	padding?: number;
	header?: React.FC<any>;
	cell?: React.FC<CellProps>;
}

interface Column<T> {
	key: string;
	column: keyof T;
	width: number;
}

export const Table: React.FC<TableProps<any>> = <T extends ScalarDict>({
	data,
	columns,
	padding = 1,
	header = Header,
	cell = Cell,
}: TableProps<T>) => {
	const cols: Column<T>[] = (columns ?? getDataKeys(data)).map((key) => {
		const headerLen = stringWidth(String(key));
		const dataLens = data.map((row) => stringWidth(String(row[key] ?? "")));
		const width = Math.max(headerLen, ...dataLens) + padding * 2;
		return { key: String(key), column: key, width };
	});

	const headings = Object.fromEntries(
		cols.map((c) => [c.column, c.column]),
	) as Partial<T>;

	return (
		<Box flexDirection="column">
			{borderTop(cols)}
			{renderRow(cols, headings, header, padding)}
			{borderSep(cols)}
			{data.map((row, index) => (
				<React.Fragment key={index.toString()}>
					{renderRow(cols, row, cell, padding)}
					{index < data.length - 1 && borderSep(cols)}
				</React.Fragment>
			))}
			{borderBottom(cols)}
		</Box>
	);
};

/* Helpers */
function getDataKeys<T extends ScalarDict>(data?: T[]): (keyof T)[] {
	return data && data.length > 0 ? (Object.keys(data[0]) as (keyof T)[]) : [];
}

/* Borders */
const borderTop = <T extends ScalarDict>(cols: Column<T>[]) => (
	<Text>{`╭${cols.map((c) => "─".repeat(c.width)).join("┬")}╮`}</Text>
);

const borderSep = <T extends ScalarDict>(cols: Column<T>[]) => (
	<Text>{`├${cols.map((c) => "─".repeat(c.width)).join("┼")}┤`}</Text>
);

const borderBottom = <T extends ScalarDict>(cols: Column<T>[]) => (
	<Text>{`╰${cols.map((c) => "─".repeat(c.width)).join("┴")}╯`}</Text>
);

/* Render a row with cells */
function renderRow<T extends ScalarDict>(
	columns: Column<T>[],
	data: Partial<T>,
	CellComp: any,
	padding: number,
) {
	return (
		<Box flexDirection="row">
			{columns.map((col, colIndex) => {
				const raw = data[col.column] ?? "";
				const v = String(raw);
				const visibleLen = stringWidth(v);
				const ml = " ".repeat(padding);
				const mr = " ".repeat(col.width - visibleLen - padding * 2);
				return (
					<React.Fragment key={`${String(col.column)}-${colIndex}`}>
						<Text>│</Text>
						<Box width={col.width}>
							<CellComp column={colIndex}>{`${ml}${v}${mr}`}</CellComp>
						</Box>
					</React.Fragment>
				);
			})}
			<Text>│</Text>
		</Box>
	);
}

/* Default Cell Renderers */
export const Header: React.FC<any> = ({ children }) => (
	<Text bold color="blue">
		{children}
	</Text>
);

export const Cell: React.FC<CellProps> = ({ children }) => (
	<Text>{children}</Text>
);
