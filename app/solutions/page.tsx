import { ChevronRight, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SolutionCodeTabs } from "../components/solution-code-tabs";
import { getSolutionSections } from "@/lib/solutions";

export const metadata = {
  title: "Solutions",
  description: "Solution notes for every problem on the probation sheet, with C++, Java, and Python code.",
};

export default function SolutionsPage() {
  const sections = getSolutionSections();

  return (
    <div className="solutions-page">
      <header className="solutions-header">
        <h1>Solutions</h1>
        <p className="solutions-intro">
          Solution notes for each problem on the sheet: the idea, the approach, complexity, pitfalls, and C++, Java, and Python code.
        </p>
      </header>

      {sections.map((section) => (
        <section className="solutions-section" key={section.section}>
          <div className="solutions-section-head">
            <h2>{section.section}</h2>
            <span className="solutions-section-count">{section.problems.length} problems</span>
          </div>
          <Card size="sm" className="solutions-card">
            <div className="solutions-list">
              {section.problems.map((problem) => (
                <details className="solution-problem" key={`${problem.contestId}-${problem.index}`}>
                  <summary className="solution-summary">
                    <span className="solution-summary-title">
                      <ChevronRight className="solution-chevron" aria-hidden="true" />
                      <span className="solution-name">{problem.name}</span>
                    </span>
                    <span className="solution-meta">
                      <span className="solution-index">
                        <span className="sr-only">Index </span>
                        {problem.index}
                      </span>
                      <span className="solution-rating">
                        <span className="sr-only">Rating </span>
                        {problem.rating}
                      </span>
                      <a
                        className="solution-link"
                        href={`https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Codeforces
                        <ExternalLink aria-hidden="true" />
                      </a>
                    </span>
                  </summary>

                  <div className="solution-body">
                    <p className="solution-idea">{problem.idea}</p>

                    <div className="solution-block">
                      <h3 className="solution-label">Approach</h3>
                      {problem.approach.map((paragraph, index) => (
                        <p className="solution-text" key={index}>{paragraph}</p>
                      ))}
                    </div>

                    <dl className="solution-complexity">
                      <div>
                        <dt>Time</dt>
                        <dd>{problem.complexity.time}</dd>
                      </div>
                      <div>
                        <dt>Space</dt>
                        <dd>{problem.complexity.space}</dd>
                      </div>
                    </dl>

                    <div className="solution-block">
                      <h3 className="solution-label">Pitfalls</h3>
                      <ul className="solution-pitfalls">
                        {problem.pitfalls.map((pitfall, index) => (
                          <li key={index}>{pitfall}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="solution-block">
                      <h3 className="solution-label">Code</h3>
                      <SolutionCodeTabs code={problem.code} />
                    </div>

                    {problem.reviewNote ? (
                      <p className="solution-review">
                        <span className="solution-label">Needs review</span>
                        {problem.reviewNote}
                      </p>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
          </Card>
        </section>
      ))}
    </div>
  );
}
