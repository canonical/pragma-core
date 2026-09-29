# Rust Standards

Standards for rust development.

## Monadic Result chaining

**Identifier:** `cs:rust.composition.result_chaining`

Use monadic Result chaining with the ? operator and combinators like and_then, map, and or_else for clean, composable error handling. This is the Rust equivalent of Haskell's do-notation for the Either monad.

### Do

Use the ? operator for clean Result propagation.
```rust
fn load_project_graph() -> Result<(SemStore, Vec<PackageGraph>), GraphError> {
    let project_root = find_project_root()
        .ok_or(GraphError::NoProjectRoot)?;

    let manifest = load_manifest(&project_root)
        .map_err(|e| GraphError::InvalidManifest {
            path: project_root.clone(),
            message: e,
        })?;

    let (store, package_graphs) = match manifest.manifest_type() {
        ManifestType::Workspace => load_workspace_graph(&project_root)?,
        ManifestType::Package => {
            let (store, graph) = load_package_graph(&project_root)?;
            (store, vec![graph])
        }
    };

    Ok((store, package_graphs))
}
```

Use and_then for dependent computations.
```rust
fn process_user_input(input: &str) -> Result<Output, ProcessError> {
    parse_input(input)
        .and_then(|parsed| validate(parsed))
        .and_then(|valid| transform(valid))
        .and_then(|transformed| save(transformed))
}
```

Use map for infallible transformations within Result.
```rust
fn get_package_names(path: &Path) -> Result<Vec<String>, IoError> {
    fs::read_dir(path)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.file_name().to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .pipe(Ok)  // or just wrap in Ok()
}

// Or more idiomatically:
fn get_config_value(key: &str) -> Result<String, ConfigError> {
    load_config()?
        .get(key)
        .map(|v| v.to_string())
        .ok_or(ConfigError::MissingKey(key.to_string()))
}
```

Use or_else for fallback computations.
```rust
fn find_config() -> Result<Config, ConfigError> {
    load_config_from_env()
        .or_else(|_| load_config_from_file())
        .or_else(|_| Ok(Config::default()))
}
```

Combine multiple Results with the ? operator in sequence.
```rust
fn setup_application() -> Result<App, SetupError> {
    let config = load_config()?;
    let db = connect_database(&config.db_url)?;
    let cache = initialize_cache(&config.cache)?;
    let logger = setup_logging(&config.log)?;

    Ok(App { config, db, cache, logger })
}
```

### Don't

Use nested match expressions for Result handling.
```rust
// Bad: Deeply nested, hard to follow
fn process(input: &str) -> Result<Output, Error> {
    match parse(input) {
        Ok(parsed) => {
            match validate(parsed) {
                Ok(valid) => {
                    match transform(valid) {
                        Ok(output) => Ok(output),
                        Err(e) => Err(e.into()),
                    }
                }
                Err(e) => Err(e.into()),
            }
        }
        Err(e) => Err(e.into()),
    }
}
```

Use unwrap() or expect() to bypass error handling.
```rust
// Bad: Panics on error
fn load_data() -> Data {
    let content = fs::read_to_string("data.json").unwrap();
    serde_json::from_str(&content).unwrap()
}
```

Ignore errors silently.
```rust
// Bad: Errors are silently dropped
fn try_save(data: &Data) {
    let _ = fs::write("data.json", serde_json::to_string(data).unwrap_or_default());
}
```

Convert all errors to strings early in the chain.
```rust
// Bad: Loses error type information
fn process() -> Result<(), String> {
    let x = step1().map_err(|e| e.to_string())?;
    let y = step2(x).map_err(|e| e.to_string())?;  // Can't distinguish errors
    Ok(())
}
```

---

## Enrich errors with context

**Identifier:** `cs:rust.errors.context_enrichment`

Always enrich errors with contextual information such as file paths, operation names, and relevant state. This dramatically improves debugging experience and follows the principle of errors as values.

### Do

Use thiserror to create structured, contextual error types.
```rust
use thiserror::Error;
use std::path::PathBuf;

#[derive(Error, Debug)]
pub enum GraphError {
    #[error("Failed to read file {path}: {source}")]
    FileRead {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    #[error("Failed to parse Turtle file {path}: {message}")]
    TurtleParse {
        path: PathBuf,
        message: String,
    },

    #[error("SPARQL query error: {0}")]
    SparqlQuery(String),

    #[error("Invalid manifest at {path}: {message}")]
    InvalidManifest {
        path: PathBuf,
        message: String,
    },
}
```

Use map_err to add context when propagating errors.
```rust
fn load_package(path: &Path) -> Result<Package, GraphError> {
    let content = fs::read_to_string(path)
        .map_err(|e| GraphError::FileRead {
            path: path.to_path_buf(),
            source: e,
        })?;

    let manifest: Manifest = toml::from_str(&content)
        .map_err(|e| GraphError::InvalidManifest {
            path: path.to_path_buf(),
            message: e.to_string(),
        })?;

    Ok(Package::from_manifest(manifest))
}
```

Chain errors to preserve the full error trail.
```rust
#[derive(Error, Debug)]
pub enum AppError {
    #[error("Failed to load configuration")]
    Config(#[from] ConfigError),

    #[error("Database operation failed")]
    Database(#[from] DatabaseError),

    #[error("Package loading failed for '{package}'")]
    PackageLoad {
        package: String,
        #[source]
        source: GraphError,
    },
}
```

Include actionable information in error messages.
```rust
#[derive(Error, Debug)]
pub enum ValidationError {
    #[error("Package name '{name}' is invalid: {reason}. Valid names contain only alphanumeric characters, hyphens, and underscores.")]
    InvalidPackageName {
        name: String,
        reason: &'static str,
    },
}
```

### Don't

Use generic string errors that lose context.
```rust
// Bad: Loses type information and context
fn load_config(path: &Path) -> Result<Config, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| e.to_string())?;  // Context lost!

    toml::from_str(&content)
        .map_err(|e| e.to_string())  // Which file? What went wrong?
}
```

Discard error information with unwrap or expect in library code.
```rust
// Bad: Panics instead of propagating
fn parse_uri(s: &str) -> Uri {
    Uri::parse(s).unwrap()  // Crashes on invalid input!
}

// Bad: expect without context
let file = File::open(path).expect("failed");  // Which path?
```

Create error types without Display or Debug.
```rust
// Bad: Unusable error type
pub struct MyError {
    code: i32,
    // No Display impl - can't print meaningful message
}
```

Use anyhow/eyre in library code (ok for applications).
```rust
// Bad in libraries: Erases type information
pub fn process() -> anyhow::Result<()> {
    // Callers can't match on specific error variants
}

// Better for libraries: Concrete error types
pub fn process() -> Result<(), ProcessError> {
    // Callers can handle specific cases
}
```

---

## Composable fallible functions

**Identifier:** `cs:rust.functions.kleisli_composition`

Structure functions as `A -> Result<B, E>` (Kleisli arrows) for composable, chainable transformations. This enables powerful composition patterns where each step can fail, following the monadic composition style from Haskell.

### Do

Design functions as Kleisli arrows: `A -> Result<B, E>`.
```rust
// Each function is a Kleisli arrow that can be composed
fn parse_config(input: &str) -> Result<RawConfig, ParseError> { /* ... */ }
fn validate_config(raw: RawConfig) -> Result<ValidConfig, ValidationError> { /* ... */ }
fn normalize_config(valid: ValidConfig) -> Result<NormalizedConfig, NormalizeError> { /* ... */ }

// Compose them with and_then (Kleisli composition)
fn load_config(input: &str) -> Result<NormalizedConfig, ConfigError> {
    parse_config(input)
        .map_err(ConfigError::Parse)?
        .pipe(validate_config)
        .map_err(ConfigError::Validation)?
        .pipe(normalize_config)
        .map_err(ConfigError::Normalize)
}

// Or with explicit and_then showing the monadic nature
fn process_input(s: &str) -> Result<Output, ProcessError> {
    parse(s)
        .and_then(validate)
        .and_then(transform)
        .and_then(finalize)
}
```

Use combinators to compose fallible operations.
```rust
impl DepSpec {
    pub fn from_value(value: &DependencyValue) -> Result<Self, ParseError> {
        match value {
            DependencyValue::Simple(s) => Self::parse(s),
            DependencyValue::Table(config) => {
                // Chain through optional fields - Kleisli-like
                config.url.as_ref()
                    .map(|url| Self::from_url(url, config))
                    .or_else(|| config.workspace.as_ref().map(|ws| Ok(DepSpec::Workspace(ws.clone()))))
                    .or_else(|| config.path.as_ref().map(|p| Ok(DepSpec::Path(p.clone()))))
                    .or_else(|| config.version.as_ref().map(|v| Ok(DepSpec::Version(v.clone()))))
                    .unwrap_or_else(|| Ok(DepSpec::Version("*".to_string())))
            }
        }
    }
}
```

Create helper traits for method chaining when needed.
```rust
trait ResultExt<T, E> {
    fn and_try<U, F>(self, f: F) -> Result<U, E>
    where
        F: FnOnce(T) -> Result<U, E>;
}

impl<T, E> ResultExt<T, E> for Result<T, E> {
    fn and_try<U, F>(self, f: F) -> Result<U, E>
    where
        F: FnOnce(T) -> Result<U, E>,
    {
        self.and_then(f)
    }
}

// Enable fluent chains
let result = input
    .and_try(step1)
    .and_try(step2)
    .and_try(step3);
```

Use the pipe pattern for readability.
```rust
// With a pipe trait or tap crate
trait Pipe: Sized {
    fn pipe<F, R>(self, f: F) -> R where F: FnOnce(Self) -> R {
        f(self)
    }
}
impl<T> Pipe for T {}

// Reads left-to-right like Unix pipes
let result = input
    .pipe(parse)
    .and_then(|x| x.pipe(validate))
    .and_then(|x| x.pipe(transform));
```

### Don't

Mix side effects into pure transformation chains.
```rust
// Bad: Side effects hidden in chain
fn process(input: &str) -> Result<Output, Error> {
    parse(input)
        .and_then(|x| {
            println!("Parsed: {:?}", x);  // Side effect!
            log_to_file(&x)?;              // More side effects!
            validate(x)
        })
        .and_then(transform)
}

// Better: Separate side effects from transformations
fn process(input: &str) -> Result<Output, Error> {
    let parsed = parse(input)?;
    log_parsed(&parsed);  // Explicit side effect

    let validated = validate(parsed)?;
    transform(validated)
}
```

Break the chain with early returns when and_then works.
```rust
// Bad: Breaks the monadic flow
fn process(input: &str) -> Result<Output, Error> {
    let parsed = parse(input)?;
    if !is_valid(&parsed) {
        return Err(Error::Invalid);
    }
    let transformed = transform(parsed)?;
    if transformed.is_empty() {
        return Err(Error::Empty);
    }
    Ok(finalize(transformed))
}

// Better: Keep the monadic chain
fn process(input: &str) -> Result<Output, Error> {
    parse(input)
        .and_then(|p| is_valid(&p).then_some(p).ok_or(Error::Invalid))
        .and_then(transform)
        .and_then(|t| (!t.is_empty()).then_some(t).ok_or(Error::Empty))
        .map(finalize)
}
```

Use unwrap in the middle of a chain.
```rust
// Bad: Panics break the monadic abstraction
let result = items.iter()
    .map(|x| parse(x).unwrap())  // Panic!
    .filter(|x| x.is_valid())
    .collect();
```

---

## Iterator pipelines over loops

**Identifier:** `cs:rust.iterators.combinator_pipelines`

Prefer iterator combinators (map, filter, flat_map, collect) over imperative loops for data transformations. This functional style is more declarative, composable, and often more performant due to lazy evaluation and compiler optimizations.

### Do

Use iterator chains for data transformations.
```rust
fn get_installed_packages() -> Result<Vec<String>, IoError> {
    let packages_path = sem_packages_dir()?;

    if !packages_path.exists() {
        return Ok(vec![]);
    }

    let mut packages: Vec<String> = fs::read_dir(&packages_path)?
        .flatten()  // Result<DirEntry> -> DirEntry (skips errors)
        .filter(|entry| entry.path().is_dir() || entry.path().is_symlink())
        .filter_map(|entry| {
            entry.path()
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
        })
        .collect();

    packages.sort();
    Ok(packages)
}
```

Use flat_map for one-to-many transformations.
```rust
fn get_all_dependencies(packages: &[Package]) -> Vec<Dependency> {
    packages.iter()
        .flat_map(|pkg| pkg.dependencies())
        .collect()
}
```

Use filter_map to combine filter and map operations.
```rust
fn parse_valid_numbers(strings: &[&str]) -> Vec<i32> {
    strings.iter()
        .filter_map(|s| s.parse::<i32>().ok())
        .collect()
}
```

Use fold/reduce for accumulating results.
```rust
fn total_size(files: &[PathBuf]) -> u64 {
    files.iter()
        .filter_map(|p| fs::metadata(p).ok())
        .map(|m| m.len())
        .sum()
}

fn merge_configs(configs: &[Config]) -> Config {
    configs.iter()
        .fold(Config::default(), |acc, cfg| acc.merge(cfg))
}
```

Chain multiple operations for complex transformations.
```rust
fn process_log_entries(entries: &[LogEntry]) -> HashMap<String, Vec<&LogEntry>> {
    entries.iter()
        .filter(|e| e.level >= LogLevel::Warning)
        .filter(|e| e.timestamp > cutoff_time)
        .fold(HashMap::new(), |mut acc, entry| {
            acc.entry(entry.source.clone())
                .or_default()
                .push(entry);
            acc
        })
}
```

Use collect with turbofish for type-driven collection.
```rust
// Collect into different types based on need
let vec: Vec<_> = iter.collect();
let set: HashSet<_> = iter.collect();
let map: HashMap<_, _> = iter.map(|x| (x.id, x)).collect();

// Collect Results - fails fast on first error
let results: Result<Vec<_>, _> = items.iter()
    .map(|item| process(item))
    .collect();
```

### Don't

Use imperative loops when combinators are clearer.
```rust
// Bad: Imperative style obscures intent
fn get_names(users: &[User]) -> Vec<String> {
    let mut names = Vec::new();
    for user in users {
        if user.is_active {
            names.push(user.name.clone());
        }
    }
    names
}

// Good: Declarative style
fn get_names(users: &[User]) -> Vec<String> {
    users.iter()
        .filter(|u| u.is_active)
        .map(|u| u.name.clone())
        .collect()
}
```

Collect intermediate results unnecessarily.
```rust
// Bad: Unnecessary allocation
let filtered: Vec<_> = items.iter().filter(|x| x.valid).collect();
let mapped: Vec<_> = filtered.iter().map(|x| x.value).collect();
let result: i32 = mapped.iter().sum();

// Good: Single lazy chain
let result: i32 = items.iter()
    .filter(|x| x.valid)
    .map(|x| x.value)
    .sum();
```

Use for loops just to build up a Vec.
```rust
// Bad: Manual Vec building
let mut results = Vec::new();
for item in items {
    results.push(transform(item));
}

// Good: Use map and collect
let results: Vec<_> = items.iter().map(transform).collect();
```

Nest loops when flat_map works.
```rust
// Bad: Nested loops
let mut all_items = Vec::new();
for container in containers {
    for item in container.items() {
        all_items.push(item);
    }
}

// Good: flat_map
let all_items: Vec<_> = containers.iter()
    .flat_map(|c| c.items())
    .collect();
```

---

## Make absence explicit with Option

**Identifier:** `cs:rust.option.explicit_absence`

Use Option explicitly and idiomatically; prefer Option<T> combinators (map, and_then, unwrap_or, ok_or) over null-like patterns. Option is Rust's Maybe monad - use it as such.

### Do

Use Option combinators for clean transformations.
```rust
impl Manifest {
    pub fn display_name(&self) -> Option<String> {
        self.workspace.as_ref()
            .and_then(|ws| ws.name.clone())
            .or_else(|| self.package.as_ref().map(|p| p.name.clone()))
    }

    pub fn version(&self) -> Option<String> {
        self.package.as_ref().map(|p| p.version.clone())
    }

    pub fn members(&self) -> Option<Vec<String>> {
        self.workspace.as_ref().map(|w| w.members.clone())
    }
}
```

Use unwrap_or and unwrap_or_else for defaults.
```rust
fn get_config_value(key: &str) -> String {
    config.get(key)
        .cloned()
        .unwrap_or_else(|| default_for_key(key))
}

fn get_timeout() -> Duration {
    env::var("TIMEOUT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(Duration::from_secs(30))
}
```

Use ok_or to convert Option to Result.
```rust
fn find_package(name: &str) -> Result<&Package, PackageError> {
    packages.get(name)
        .ok_or_else(|| PackageError::NotFound(name.to_string()))
}

fn get_required_field<'a>(map: &'a HashMap<String, Value>, key: &str) -> Result<&'a Value, ConfigError> {
    map.get(key)
        .ok_or(ConfigError::MissingField(key.to_string()))
}
```

Use filter and filter_map for conditional processing.
```rust
fn find_active_user(id: UserId) -> Option<User> {
    users.get(&id).filter(|u| u.is_active)
}

fn get_valid_entries(entries: &[Entry]) -> Vec<&Entry> {
    entries.iter()
        .filter(|e| e.is_valid())
        .collect()
}
```

Use the ? operator with Option in functions returning Option.
```rust
fn get_nested_value(data: &Data) -> Option<&str> {
    let section = data.sections.get("main")?;
    let item = section.items.first()?;
    item.value.as_deref()
}
```

### Don't

Use sentinel values instead of Option.
```rust
// Bad: Magic values
fn find_index(items: &[Item], target: &Item) -> i32 {
    // Returns -1 if not found - caller might forget to check!
    items.iter().position(|i| i == target).map(|i| i as i32).unwrap_or(-1)
}

// Good: Explicit Option
fn find_index(items: &[Item], target: &Item) -> Option<usize> {
    items.iter().position(|i| i == target)
}
```

Overuse unwrap() or expect() outside of tests.
```rust
// Bad: Panics on None
let user = users.get(id).unwrap();
let name = user.name.as_ref().unwrap();

// Good: Handle absence explicitly
let user = users.get(id).ok_or(UserError::NotFound(id))?;
let name = user.name.as_deref().unwrap_or("Anonymous");
```

Check is_some/is_none then unwrap.
```rust
// Bad: Redundant check
if value.is_some() {
    let v = value.unwrap();  // We just checked!
    process(v);
}

// Good: Use if let or map
if let Some(v) = value {
    process(v);
}

// Or even better for side effects
value.map(process);
```

Create deeply nested Option chains without combinators.
```rust
// Bad: Nested matching
match outer {
    Some(o) => match o.inner {
        Some(i) => match i.value {
            Some(v) => Some(transform(v)),
            None => None,
        },
        None => None,
    },
    None => None,
}

// Good: Combinator chain
outer
    .and_then(|o| o.inner)
    .and_then(|i| i.value)
    .map(transform)
```

---

## Property-based testing for invariants

**Identifier:** `cs:rust.testing.property_based`

Complement unit tests with property-based testing to verify invariants across many generated inputs. This QuickCheck-inspired approach catches edge cases that example-based tests miss.

### Do

Use proptest for property-based testing.
```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn parse_roundtrip(s in "[a-z][a-z0-9_-]{0,63}") {
        let name = PackageName::new(&s).unwrap();
        assert_eq!(name.as_str(), s);
    }

    #[test]
    fn version_ordering(a in 0u32..1000, b in 0u32..1000, c in 0u32..1000,
                        x in 0u32..1000, y in 0u32..1000, z in 0u32..1000) {
        let v1 = Version::new(a, b, c);
        let v2 = Version::new(x, y, z);

        // Ordering should be consistent
        if v1 < v2 {
            assert!(v2 > v1);
            assert!(v1 <= v2);
        }
    }
}
```

Test algebraic properties (identity, associativity, commutativity).
```rust
proptest! {
    #[test]
    fn merge_associative(a: Config, b: Config, c: Config) {
        // (a.merge(b)).merge(c) == a.merge(b.merge(c))
        let left = a.clone().merge(&b).merge(&c);
        let right = a.merge(&b.merge(&c));
        assert_eq!(left, right);
    }

    #[test]
    fn merge_identity(config: Config) {
        // config.merge(empty) == config
        let merged = config.clone().merge(&Config::default());
        assert_eq!(merged, config);
    }
}
```

Test invariants that should hold for all valid inputs.
```rust
proptest! {
    #[test]
    fn validated_email_contains_at(s in ".+@.+\\..+") {
        if let Ok(email) = Email::parse(&s) {
            assert!(email.as_str().contains('@'));
        }
    }

    #[test]
    fn uri_resolve_compact_roundtrip(prefix in "[a-z]+", local in "[a-zA-Z][a-zA-Z0-9]*") {
        let prefixed = format!("{}:{}", prefix, local);
        let map = PrefixMap::default();

        if let Some(resolved) = map.resolve(&prefixed) {
            let compacted = map.compact(&resolved);
            // Should roundtrip (or return full URI if prefix unknown)
            assert!(compacted == prefixed || compacted == resolved);
        }
    }
}
```

Use custom strategies for domain-specific types.
```rust
fn valid_package_name() -> impl Strategy<Value = String> {
    "[a-z][a-z0-9-]{0,62}[a-z0-9]?"
        .prop_filter("Must not have consecutive hyphens", |s| !s.contains("--"))
}

fn valid_version() -> impl Strategy<Value = Version> {
    (0u32..1000, 0u32..1000, 0u32..1000)
        .prop_map(|(major, minor, patch)| Version::new(major, minor, patch))
}

proptest! {
    #[test]
    fn package_names_are_valid(name in valid_package_name()) {
        assert!(PackageName::new(&name).is_ok());
    }
}
```

### Don't

Only write example-based unit tests for complex logic.
```rust
// Incomplete: Only tests a few examples
#[test]
fn test_merge() {
    let a = Config { timeout: 10, retries: 3 };
    let b = Config { timeout: 20, retries: 5 };
    let merged = a.merge(&b);
    assert_eq!(merged.timeout, 20);
    // What about edge cases? Overflow? Default values?
}
```

Ignore test failures without understanding the counterexample.
```rust
// Bad: Ignoring failures
proptest! {
    #[test]
    #[ignore]  // "It fails sometimes, I'll fix it later"
    fn flaky_property(x: i32) {
        // ...
    }
}
```

Write properties that are too weak or tautological.
```rust
// Bad: This always passes, tests nothing useful
proptest! {
    #[test]
    fn useless_property(x: i32) {
        let result = process(x);
        assert!(result == result);  // Tautology!
    }
}

// Bad: Property is just the implementation
proptest! {
    #[test]
    fn reimplements_function(a: i32, b: i32) {
        assert_eq!(add(a, b), a + b);  // Just restates the implementation
    }
}
```

Generate invalid inputs without proper filtering.
```rust
// Bad: Generates invalid UTF-8 and panics
proptest! {
    #[test]
    fn bad_string_test(bytes: Vec<u8>) {
        let s = String::from_utf8(bytes).unwrap();  // Panics on invalid UTF-8!
    }
}

// Good: Use proper string strategies
proptest! {
    #[test]
    fn good_string_test(s: String) {  // proptest generates valid strings
        // ...
    }
}
```

---

## Red, green, refactor

**Identifier:** `cs:rust.testing.tdd_red_green_refactor`

Follow the strict TDD cycle: write a failing test first (red), implement minimally to pass (green), then refactor. This discipline ensures testability, prevents regression, and drives better design.

### Do

Write the test first, watch it fail.
```rust
// Step 1: RED - Write failing test
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_semver() {
        let version = Version::parse("1.2.3").unwrap();
        assert_eq!(version.major, 1);
        assert_eq!(version.minor, 2);
        assert_eq!(version.patch, 3);
    }
}

// At this point: cargo test fails - Version doesn't exist yet!
```

Implement the minimum code to pass.
```rust
// Step 2: GREEN - Minimal implementation
pub struct Version {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}

impl Version {
    pub fn parse(s: &str) -> Result<Self, ParseError> {
        let parts: Vec<&str> = s.split('.').collect();
        if parts.len() != 3 {
            return Err(ParseError::InvalidFormat);
        }
        Ok(Self {
            major: parts[0].parse().map_err(|_| ParseError::InvalidNumber)?,
            minor: parts[1].parse().map_err(|_| ParseError::InvalidNumber)?,
            patch: parts[2].parse().map_err(|_| ParseError::InvalidNumber)?,
        })
    }
}

// cargo test passes!
```

Refactor while keeping tests green.
```rust
// Step 3: REFACTOR - Improve design
impl Version {
    pub fn parse(s: &str) -> Result<Self, ParseError> {
        let mut parts = s.splitn(3, '.');

        let major = Self::parse_component(parts.next())?;
        let minor = Self::parse_component(parts.next())?;
        let patch = Self::parse_component(parts.next())?;

        if parts.next().is_some() {
            return Err(ParseError::TooManyComponents);
        }

        Ok(Self { major, minor, patch })
    }

    fn parse_component(s: Option<&str>) -> Result<u32, ParseError> {
        s.ok_or(ParseError::MissingComponent)?
            .parse()
            .map_err(|_| ParseError::InvalidNumber)
    }
}

// Tests still pass after refactoring!
```

Add tests for edge cases incrementally.
```rust
#[test]
fn parse_rejects_empty_string() {
    assert!(Version::parse("").is_err());
}

#[test]
fn parse_rejects_non_numeric() {
    assert!(Version::parse("a.b.c").is_err());
}

#[test]
fn parse_rejects_negative_numbers() {
    assert!(Version::parse("-1.0.0").is_err());
}

#[test]
fn parse_handles_leading_zeros() {
    let v = Version::parse("01.02.03").unwrap();
    assert_eq!(v.major, 1);  // Decide: allow or reject?
}
```

Use test modules colocated with implementation.
```rust
// src/version.rs
pub struct Version { /* ... */ }

impl Version {
    pub fn parse(s: &str) -> Result<Self, ParseError> { /* ... */ }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Tests live next to the code they test
    #[test]
    fn test_parse() { /* ... */ }
}
```

### Don't

Write implementation before tests.
```rust
// Bad: Implementation without tests
pub fn complex_algorithm(input: &str) -> Result<Output, Error> {
    // 200 lines of complex logic
    // No tests to verify correctness
    // No tests to prevent regression
}
```

Write tests that pass trivially or test nothing.
```rust
// Bad: Test that always passes
#[test]
fn useless_test() {
    assert!(true);
}

// Bad: Test that doesn't assert behavior
#[test]
fn test_without_assertions() {
    let _ = Version::parse("1.0.0");  // No assertions!
}
```

Skip the refactor step.
```rust
// Bad: "It works, ship it!"
impl Version {
    pub fn parse(s: &str) -> Result<Self, ParseError> {
        // Copy-pasted code, magic numbers, unclear logic
        // "I'll clean it up later" (narrator: they didn't)
        let p: Vec<&str> = s.split('.').collect();
        if p.len() != 3 { return Err(ParseError::X); }
        let a = p[0].parse::<u32>();
        let b = p[1].parse::<u32>();
        let c = p[2].parse::<u32>();
        if a.is_err() || b.is_err() || c.is_err() { return Err(ParseError::Y); }
        Ok(Self { major: a.unwrap(), minor: b.unwrap(), patch: c.unwrap() })
    }
}
```

Write tests after the fact that just confirm current behavior.
```rust
// Bad: "Characterization tests" without understanding intent
#[test]
fn test_weird_behavior() {
    // I don't know why it returns 42, but it does, so test it
    assert_eq!(mysterious_function("input"), 42);
}
```

Test private implementation details.
```rust
// Bad: Testing internals that may change
#[test]
fn test_internal_cache_structure() {
    let obj = MyStruct::new();
    // Accessing private fields via unsafe or reflection
    assert_eq!(obj.internal_cache.len(), 0);  // Fragile!
}

// Good: Test public behavior
#[test]
fn test_caching_behavior() {
    let obj = MyStruct::new();
    let result1 = obj.expensive_operation();
    let result2 = obj.expensive_operation();  // Should be cached
    assert_eq!(result1, result2);
}
```

---

## Small, composable traits

**Identifier:** `cs:rust.traits.small_composable`

Prefer small, focused traits that compose well over large monolithic interfaces. This Haskell typeclass-inspired approach enables better abstraction, easier testing, and more flexible code reuse.

### Do

Design small, single-purpose traits.
```rust
/// Can be resolved from a prefixed form to a full URI
trait Resolvable {
    fn resolve(&self, prefix_map: &PrefixMap) -> String;
}

/// Can be compacted from a full URI to a prefixed form
trait Compactable {
    fn compact(&self, prefix_map: &PrefixMap) -> String;
}

/// Can be validated against constraints
trait Validatable {
    type Error;
    fn validate(&self) -> Result<(), Self::Error>;
}

/// Can be loaded from a path
trait Loadable: Sized {
    type Error;
    fn load(path: &Path) -> Result<Self, Self::Error>;
}
```

Compose traits using supertraits and bounds.
```rust
// Compose small traits into larger capabilities
trait UriHandler: Resolvable + Compactable {}

// Automatic implementation for types that have both
impl<T: Resolvable + Compactable> UriHandler for T {}

// Use trait bounds for flexible functions
fn process_uri<T: Resolvable + Display>(uri: &T, map: &PrefixMap) -> String {
    format!("{} -> {}", uri, uri.resolve(map))
}
```

Use extension traits to add methods to existing types.
```rust
trait ResultExt<T, E> {
    fn context(self, msg: &str) -> Result<T, ContextError<E>>;
    fn with_context<F: FnOnce() -> String>(self, f: F) -> Result<T, ContextError<E>>;
}

impl<T, E> ResultExt<T, E> for Result<T, E> {
    fn context(self, msg: &str) -> Result<T, ContextError<E>> {
        self.map_err(|e| ContextError { context: msg.to_string(), source: e })
    }

    fn with_context<F: FnOnce() -> String>(self, f: F) -> Result<T, ContextError<E>> {
        self.map_err(|e| ContextError { context: f(), source: e })
    }
}

// Usage
let data = fs::read_to_string(path)
    .context("failed to read config")?;
```

Implement standard library traits for interoperability.
```rust
impl Default for SemStore {
    fn default() -> Self {
        Self::new().expect("Failed to create default SemStore")
    }
}

impl Display for PackageName {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl FromStr for Version {
    type Err = ParseVersionError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        // parsing logic
    }
}
```

### Don't

Create large, monolithic traits.
```rust
// Bad: Too many responsibilities
trait Repository {
    fn connect(&mut self) -> Result<(), Error>;
    fn disconnect(&mut self) -> Result<(), Error>;
    fn find_by_id(&self, id: &str) -> Result<Entity, Error>;
    fn find_all(&self) -> Result<Vec<Entity>, Error>;
    fn save(&mut self, entity: &Entity) -> Result<(), Error>;
    fn delete(&mut self, id: &str) -> Result<(), Error>;
    fn begin_transaction(&mut self) -> Result<Transaction, Error>;
    fn commit(&mut self) -> Result<(), Error>;
    fn rollback(&mut self) -> Result<(), Error>;
    fn execute_query(&self, query: &str) -> Result<QueryResult, Error>;
    // ... 20 more methods
}
```

Use trait objects when generics suffice.
```rust
// Bad: Unnecessary dynamic dispatch
fn process(items: &[Box<dyn Processable>]) {
    for item in items {
        item.process();
    }
}

// Good: Static dispatch with generics
fn process<T: Processable>(items: &[T]) {
    for item in items {
        item.process();
    }
}
```

Require unused trait methods via blanket requirements.
```rust
// Bad: Forces implementers to provide unused methods
trait DataStore: Connect + Query + Mutate + Transaction + Cache + Log {
    // Most implementers don't need all of these
}

// Good: Compose only what's needed
fn process<T: Query + Mutate>(store: &mut T) {
    // Only requires the capabilities actually used
}
```

Use associated types when generic parameters work better.
```rust
// Bad: Can only have one implementation per type
trait Container {
    type Item;
    fn get(&self) -> &Self::Item;
}

// Good: Allows multiple implementations
trait Container<T> {
    fn get(&self) -> &T;
}
// Now Vec<i32> can be Container<i32> AND Container<String> if needed
```

---

## Model variants with enums

**Identifier:** `cs:rust.types.discriminated_unions`

Model state and variants with enums (algebraic sum types) rather than flags, inheritance, or stringly-typed values. Exhaustive pattern matching ensures all cases are handled at compile time - Rust's killer feature borrowed from ML/Haskell.

### Do

Use enums to model mutually exclusive states.
```rust
#[derive(Debug, Clone, PartialEq)]
pub enum DepSpec {
    Workspace(String),
    Path(String),
    Version(String),
    Url {
        url: String,
        version: Option<String>,
        include: Option<Vec<String>>,
        exclude: Option<Vec<String>>,
    },
}

impl DepSpec {
    pub fn resolve(&self, workspace_root: &Path) -> Result<PathBuf, ResolveError> {
        match self {
            DepSpec::Workspace(name) => resolve_workspace_member(workspace_root, name),
            DepSpec::Path(path) => Ok(workspace_root.join(path)),
            DepSpec::Version(ver) => fetch_from_registry(ver),
            DepSpec::Url { url, .. } => fetch_from_url(url),
        }
    }
}
```

Use enums for state machines with compile-time guarantees.
```rust
enum ConnectionState {
    Disconnected,
    Connecting { attempt: u32 },
    Connected { session_id: String },
    Error { message: String, retries: u32 },
}

impl ConnectionState {
    fn can_send(&self) -> bool {
        matches!(self, ConnectionState::Connected { .. })
    }

    fn transition(self, event: Event) -> Self {
        match (self, event) {
            (ConnectionState::Disconnected, Event::Connect) =>
                ConnectionState::Connecting { attempt: 1 },
            (ConnectionState::Connecting { .. }, Event::Success(id)) =>
                ConnectionState::Connected { session_id: id },
            (ConnectionState::Connecting { attempt }, Event::Failure(msg)) if attempt < 3 =>
                ConnectionState::Connecting { attempt: attempt + 1 },
            (ConnectionState::Connecting { attempt }, Event::Failure(msg)) =>
                ConnectionState::Error { message: msg, retries: attempt },
            (state, _) => state,  // Invalid transitions are no-ops
        }
    }
}
```

Use enums to make invalid states unrepresentable.
```rust
// User can be either anonymous or authenticated, never both
enum User {
    Anonymous,
    Authenticated {
        id: UserId,
        email: Email,
        roles: Vec<Role>,
    },
}

// A form field is either pristine, touched, or submitted
enum FieldState<T> {
    Pristine,
    Touched { value: T, errors: Vec<ValidationError> },
    Submitted { value: T },
}
```

Leverage exhaustive matching for safety.
```rust
fn handle_result(result: QueryResult) -> Response {
    match result {
        QueryResult::Success(data) => Response::json(data),
        QueryResult::NotFound => Response::status(404),
        QueryResult::Unauthorized => Response::status(401),
        QueryResult::RateLimited { retry_after } => {
            Response::status(429).header("Retry-After", retry_after)
        }
        // Compiler error if we forget a variant!
    }
}
```

### Don't

Use boolean flags for mutually exclusive states.
```rust
// Bad: Multiple bools can have invalid combinations
struct User {
    is_anonymous: bool,
    is_authenticated: bool,  // What if both are true?
    is_admin: bool,
}

// Bad: Stringly-typed state
struct Connection {
    state: String,  // "connected", "disconnected", typos possible
}
```

Use Option when you need more than two states.
```rust
// Bad: Option doesn't capture "loading" vs "error" vs "empty"
struct DataView {
    data: Option<Vec<Item>>,  // Is None loading, error, or empty?
}

// Good: Explicit states
enum DataState {
    Loading,
    Empty,
    Loaded(Vec<Item>),
    Error(String),
}
```

Use inheritance-like patterns with trait objects when enums suffice.
```rust
// Bad: Runtime dispatch when compile-time would work
trait Shape {
    fn area(&self) -> f64;
}
struct Circle { radius: f64 }
struct Rectangle { width: f64, height: f64 }
fn process(shape: &dyn Shape) { /* ... */ }

// Good: Enum when variants are known
enum Shape {
    Circle { radius: f64 },
    Rectangle { width: f64, height: f64 },
}
impl Shape {
    fn area(&self) -> f64 {
        match self {
            Shape::Circle { radius } => std::f64::consts::PI * radius * radius,
            Shape::Rectangle { width, height } => width * height,
        }
    }
}
```

Use integers or strings as type discriminators.
```rust
// Bad: Magic numbers
const USER_TYPE_ADMIN: i32 = 1;
const USER_TYPE_MEMBER: i32 = 2;
struct User { user_type: i32 }

// Bad: Stringly typed
struct Message { msg_type: String }  // "request", "response", typos!
```

---

## Newtype wrappers for domain values

**Identifier:** `cs:rust.types.newtype_wrappers`

Use the newtype pattern to create distinct types for domain-specific values, preventing accidental mixing of semantically different data. This Haskell-inspired pattern provides compile-time safety with zero runtime cost.

### Do

Wrap primitive types in newtypes for domain semantics.
```rust
/// A validated package name following sem conventions
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PackageName(String);

impl PackageName {
    pub fn new(name: impl Into<String>) -> Result<Self, ValidationError> {
        let name = name.into();
        if name.is_empty() {
            return Err(ValidationError::EmptyName);
        }
        if !name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            return Err(ValidationError::InvalidCharacters);
        }
        Ok(Self(name))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}
```

Use newtypes to distinguish semantically different IDs.
```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct UserId(u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct OrderId(u64);

// Compiler prevents mixing:
fn process_order(user: UserId, order: OrderId) { /* ... */ }

// This won't compile:
// process_order(order_id, user_id);  // Error: expected UserId, found OrderId
```

Derive common traits to maintain ergonomics.
```rust
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Uri(String);
```

Use phantom types for compile-time state tracking.
```rust
use std::marker::PhantomData;

struct Validated;
struct Unvalidated;

struct Input<State> {
    data: String,
    _state: PhantomData<State>,
}

impl Input<Unvalidated> {
    fn validate(self) -> Result<Input<Validated>, ValidationError> {
        // validation logic...
        Ok(Input { data: self.data, _state: PhantomData })
    }
}

impl Input<Validated> {
    fn process(&self) -> Output {
        // Only validated inputs can be processed
    }
}
```

### Don't

Use raw primitive types for domain concepts.
```rust
// Bad: Raw strings lose semantic meaning
fn load_package(name: String, path: String, uri: String) {
    // Easy to mix up arguments - compiler can't help
}

// Bad: Easy to accidentally swap arguments
load_package(uri, name, path);  // Compiles but wrong!
```

Create newtypes without validation when invariants exist.
```rust
// Bad: Allows invalid state
pub struct Email(pub String);  // pub field allows any string

// Better: Enforce invariants at construction
pub struct Email(String);  // Private field
impl Email {
    pub fn new(s: &str) -> Result<Self, EmailError> {
        if s.contains('@') && s.contains('.') {
            Ok(Self(s.to_string()))
        } else {
            Err(EmailError::Invalid)
        }
    }
}
```

Over-wrap types that don't need semantic distinction.
```rust
// Bad: Unnecessary wrapping of implementation details
struct LoopCounter(usize);  // Just use usize
struct TempBuffer(Vec<u8>);  // Just use Vec<u8>
```

---

## Parse, don't validate

**Identifier:** `cs:rust.validation.typestate_guards`

Use constructor validation to ensure only valid states can exist. Follow the 'parse, don't validate' principle: transform unvalidated data into validated types at system boundaries, making invalid states unrepresentable.

### Do

Validate in constructors to ensure type invariants.
```rust
impl Manifest {
    pub fn from_path(path: &Path) -> Result<Self, ManifestError> {
        let content = fs::read_to_string(path)
            .map_err(|e| ManifestError::ReadError { path: path.into(), source: e })?;
        Self::from_str(&content)
    }

    pub fn from_str(content: &str) -> Result<Self, ManifestError> {
        let manifest: Manifest = toml::from_str(content)
            .map_err(|e| ManifestError::ParseError(e.to_string()))?;
        manifest.validate()?;  // Validation guards construction
        Ok(manifest)
    }

    fn validate(&self) -> Result<(), ManifestError> {
        match (&self.workspace, &self.package) {
            (Some(_), Some(_)) => Err(ManifestError::BothWorkspaceAndPackage),
            (None, None) => Err(ManifestError::NeitherWorkspaceNorPackage),
            _ => Ok(()),
        }
    }
}
```

Use the typestate pattern for compile-time state enforcement.
```rust
// States as zero-sized types
struct Draft;
struct Published;
struct Archived;

struct Article<State> {
    id: ArticleId,
    title: String,
    content: String,
    _state: PhantomData<State>,
}

impl Article<Draft> {
    fn new(title: String, content: String) -> Self {
        Self { id: ArticleId::new(), title, content, _state: PhantomData }
    }

    fn publish(self) -> Article<Published> {
        Article { id: self.id, title: self.title, content: self.content, _state: PhantomData }
    }
}

impl Article<Published> {
    fn archive(self) -> Article<Archived> {
        Article { id: self.id, title: self.title, content: self.content, _state: PhantomData }
    }

    fn view(&self) -> &str {
        &self.content  // Only published articles can be viewed
    }
}

// Compile-time enforcement:
// article_draft.view();  // Error: method not found
// article_published.publish();  // Error: method not found
```

Parse into validated types at system boundaries.
```rust
// Raw input from external source
struct RawUserInput {
    email: String,
    age: String,
}

// Validated domain types
struct Email(String);
struct Age(u8);
struct ValidatedUser {
    email: Email,
    age: Age,
}

impl RawUserInput {
    fn parse(self) -> Result<ValidatedUser, ValidationError> {
        let email = Email::parse(&self.email)?;
        let age = Age::parse(&self.age)?;
        Ok(ValidatedUser { email, age })
    }
}

impl Email {
    fn parse(s: &str) -> Result<Self, ValidationError> {
        if s.contains('@') && s.len() > 3 {
            Ok(Self(s.to_string()))
        } else {
            Err(ValidationError::InvalidEmail(s.to_string()))
        }
    }
}
```

Make the validated state obvious in function signatures.
```rust
// Functions that require validation communicate it via types
fn send_email(to: &Email, subject: &str, body: &str) -> Result<(), SendError> {
    // Email is already validated - no need to check again
}

fn create_account(user: ValidatedUser) -> Result<Account, AccountError> {
    // All fields are pre-validated
}
```

### Don't

Scatter validation logic throughout the codebase.
```rust
// Bad: Validation repeated everywhere
fn send_email(to: &str, subject: &str, body: &str) -> Result<(), Error> {
    if !to.contains('@') {
        return Err(Error::InvalidEmail);  // Validation here
    }
    // ... send logic
}

fn save_user(email: &str) -> Result<(), Error> {
    if !email.contains('@') {
        return Err(Error::InvalidEmail);  // Duplicate validation!
    }
    // ... save logic
}
```

Allow construction of invalid objects.
```rust
// Bad: Public fields allow invalid state
pub struct Email {
    pub address: String,  // Anyone can set invalid value
}

// Bad: No validation in constructor
impl User {
    pub fn new(email: String, age: i32) -> Self {
        Self { email, age }  // Could be invalid!
    }
}
```

Use validation functions that return bool.
```rust
// Bad: Caller can ignore the result
fn is_valid_email(s: &str) -> bool {
    s.contains('@')
}

let email = user_input;
if is_valid_email(&email) {
    // What if we forget this check elsewhere?
}

// Good: Parsing forces handling
fn parse_email(s: &str) -> Result<Email, ValidationError>
// Caller must handle the Result
```

Re-validate already-validated data.
```rust
// Bad: Redundant validation
fn process(user: ValidatedUser) -> Result<(), Error> {
    // ValidatedUser is already valid by construction!
    if user.email.as_str().is_empty() {
        return Err(Error::InvalidEmail);  // Unnecessary!
    }
    // ...
}
```

---
