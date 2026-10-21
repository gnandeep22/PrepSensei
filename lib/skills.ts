// Shared, evidence-based skill vocabulary.
// Used by both the resume parser and the JSearch normalizer so that skills are
// only ever surfaced when they actually appear in source text (no invention).

type SkillDef = { canonical: string; aliases?: string[] }

const SKILLS: SkillDef[] = [
  { canonical: "Python" },
  { canonical: "JavaScript", aliases: ["javascript"] },
  { canonical: "TypeScript", aliases: ["typescript"] },
  { canonical: "Java" },
  { canonical: "C++", aliases: ["cpp"] },
  { canonical: "C#", aliases: ["c-sharp", "csharp"] },
  { canonical: "Ruby" },
  { canonical: "PHP" },
  { canonical: "Swift" },
  { canonical: "Kotlin" },
  { canonical: "Scala" },
  { canonical: "Golang", aliases: ["golang"] },
  { canonical: "Rust" },
  { canonical: "SQL" },
  { canonical: "HTML" },
  { canonical: "CSS" },
  { canonical: "Sass", aliases: ["scss"] },
  { canonical: "Tailwind", aliases: ["tailwind css", "tailwindcss"] },
  { canonical: "React", aliases: ["react.js", "reactjs"] },
  { canonical: "Next.js", aliases: ["next.js", "nextjs"] },
  { canonical: "Vue", aliases: ["vue.js", "vuejs"] },
  { canonical: "Angular" },
  { canonical: "Svelte" },
  { canonical: "Node.js", aliases: ["node.js", "nodejs", "node js"] },
  { canonical: "Express", aliases: ["express.js", "expressjs"] },
  { canonical: "Django" },
  { canonical: "Flask" },
  { canonical: "FastAPI", aliases: ["fast api"] },
  { canonical: "Spring", aliases: ["spring boot"] },
  { canonical: "Rails", aliases: ["ruby on rails"] },
  { canonical: "Laravel" },
  { canonical: ".NET", aliases: ["dotnet", "asp.net"] },
  { canonical: "GraphQL" },
  { canonical: "REST APIs", aliases: ["rest api", "rest apis", "restful", "restful api"] },
  { canonical: "PostgreSQL", aliases: ["postgres", "postgresql"] },
  { canonical: "MySQL" },
  { canonical: "MongoDB", aliases: ["mongo"] },
  { canonical: "Redis" },
  { canonical: "SQLite" },
  { canonical: "Oracle" },
  { canonical: "Elasticsearch" },
  { canonical: "DynamoDB" },
  { canonical: "Docker" },
  { canonical: "Kubernetes", aliases: ["k8s"] },
  { canonical: "AWS", aliases: ["amazon web services"] },
  { canonical: "Azure" },
  { canonical: "GCP", aliases: ["google cloud"] },
  { canonical: "Terraform" },
  { canonical: "Jenkins" },
  { canonical: "CI/CD", aliases: ["ci/cd", "cicd"] },
  { canonical: "Git" },
  { canonical: "Linux" },
  { canonical: "Bash", aliases: ["shell scripting"] },
  { canonical: "Machine Learning", aliases: ["machine learning"] },
  { canonical: "Deep Learning", aliases: ["deep learning"] },
  { canonical: "PyTorch", aliases: ["pytorch"] },
  { canonical: "TensorFlow", aliases: ["tensorflow"] },
  { canonical: "Pandas" },
  { canonical: "NumPy", aliases: ["numpy"] },
  { canonical: "scikit-learn", aliases: ["scikit-learn", "sklearn"] },
  { canonical: "NLP", aliases: ["natural language processing"] },
  { canonical: "Airflow", aliases: ["apache airflow"] },
  { canonical: "Spark", aliases: ["apache spark", "pyspark"] },
  { canonical: "Hadoop" },
  { canonical: "Kafka", aliases: ["apache kafka"] },
  { canonical: "Tableau" },
  { canonical: "Power BI", aliases: ["power bi", "powerbi"] },
  { canonical: "Figma" },
  { canonical: "Jira" },
  { canonical: "Agile" },
  { canonical: "Scrum" },
  { canonical: "System Design", aliases: ["system design"] },
  { canonical: "Microservices", aliases: ["micro-services"] },
  { canonical: "Testing", aliases: ["unit testing", "unit tests"] },
  { canonical: "Selenium" },
  { canonical: "Cypress" },
  { canonical: "Jest" },
]

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// A term matches only when bounded by non-identifier characters, so "java"
// never matches inside "javascript" and "c#"/"c++" match precisely.
function makeMatcher(term: string) {
  const pattern = escapeRegex(term.toLowerCase())
  return new RegExp(`(?<![a-z0-9+#.])${pattern}(?![a-z0-9+#.])`, "i")
}

const MATCHERS: { canonical: string; regexes: RegExp[] }[] = SKILLS.map((s) => ({
  canonical: s.canonical,
  regexes: [s.canonical, ...(s.aliases ?? [])].map(makeMatcher),
}))

/** Return the canonical skills whose name or aliases appear in the given text. */
export function extractSkills(text: string): string[] {
  if (!text) return []
  const found: string[] = []
  for (const { canonical, regexes } of MATCHERS) {
    if (regexes.some((re) => re.test(text))) found.push(canonical)
  }
  return Array.from(new Set(found))
}
