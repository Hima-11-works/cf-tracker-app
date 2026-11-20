import warmUpJson from "@/content/solutions/warm-up-adhocs.json";
import prefixSumJson from "@/content/solutions/prefix-sum-difference-array.json";
import sortingJson from "@/content/solutions/sorting.json";
import greedyJson from "@/content/solutions/greedy.json";
import twoPointersJson from "@/content/solutions/two-pointers-sliding-window.json";
import bitManipulationJson from "@/content/solutions/bit-manipulation.json";
import stringsJson from "@/content/solutions/strings.json";
import mathJson from "@/content/solutions/math.json";
import binarySearchJson from "@/content/solutions/binary-search.json";
import constructiveJson from "@/content/solutions/constructive-algorithm.json";

export type SolutionComplexity = {
  time: string;
  space: string;
};

export type SolutionCode = {
  cpp: string;
  java: string;
  python: string;
};

export type SolutionProblem = {
  contestId: number;
  index: string;
  name: string;
  rating: number;
  idea: string;
  approach: string[];
  complexity: SolutionComplexity;
  pitfalls: string[];
  code: SolutionCode;
  reviewNote: string | null;
};

export type SolutionSection = {
  section: string;
  problems: SolutionProblem[];
};

const warmUp: SolutionSection = warmUpJson;
const prefixSum: SolutionSection = prefixSumJson;
const sorting: SolutionSection = sortingJson;
const greedy: SolutionSection = greedyJson;
const twoPointers: SolutionSection = twoPointersJson;
const bitManipulation: SolutionSection = bitManipulationJson;
const strings: SolutionSection = stringsJson;
const math: SolutionSection = mathJson;
const binarySearch: SolutionSection = binarySearchJson;
const constructive: SolutionSection = constructiveJson;

export const solutionSections: SolutionSection[] = [
  warmUp,
  prefixSum,
  sorting,
  greedy,
  twoPointers,
  bitManipulation,
  strings,
  math,
  binarySearch,
  constructive,
];

export function getSolutionSections(): SolutionSection[] {
  return solutionSections;
}
