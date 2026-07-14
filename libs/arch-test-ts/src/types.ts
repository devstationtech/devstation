/** Public types shared by the arch package. */

export type PathGlob = string;
export type PathGlobs = PathGlob | readonly PathGlob[];

/** An exception lifts a rule for a specific file (or file/dep pair). */
export type Exception =
  | PathGlob
  | readonly PathGlob[]
  | { from?: PathGlobs; to?: PathGlobs; reason?: string };

export type AssertionKind =
  | "toImport"
  | "toNotImport"
  | "toOnlyImport"
  | "toOnlyBeImportedBy";

export type Rule = {
  name: string;
  sources: PathGlob[];
  exts: string[];
  assertion: Assertion;
  exceptions: ExceptionSpec[];
};

export type Assertion =
  | { kind: "toImport"; targets: PathGlob[] }
  | { kind: "toNotImport"; targets: PathGlob[] }
  | { kind: "toOnlyImport"; targets: PathGlob[] }
  | {
    kind: "toOnlyBeImportedBy";
    allowedUsers: PathGlob[];
    within: PathGlob[];
    withinExts: string[];
  };

export type ExceptionSpec = {
  from?: PathGlob[]; // file predicate
  to?: PathGlob[]; // dep predicate
  reason?: string;
};
