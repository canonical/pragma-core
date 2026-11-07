# Styling Standards

Standards for styling development.

## Themes as semantic token sets

**Identifier:** `cs:styling.themes.definition`

Themes are collections of semantic tokens that provide consistent styling across components. See cs:css.themes.activation for implementation details.

### Do

Define a theme as a complete set of semantic tokens.
```
{
  "theme": {
    "canonical": {
      "color": {
        "background": {
          "default": {
            "$type": "color",
        "$value": "{color.neutral.100}"
          }
        }
      }
    }
  }
}
```

### Don't

Mix implementation details into theme definitions.
```
{
  "theme": {
    "canonical": {
      "class": "canonical",     // Bad: CSS implementation detail
      "container": "div",       // Bad: HTML implementation detail
    }
  }
}
```

---

## Tokenize every design decision

**Identifier:** `cs:styling.tokens.creation`

Design tokens must be created for all design decisions in a component. See cs:css.properties.values for how these tokens are used in CSS implementation.

### Do

Create component tokens that reference semantic tokens for design decisions.
```
{
  "button": {
    "background": {
      "$type": "color",
        "$value": "{color.background.primary}"
    }
  }
}
```

### Don't

Use raw values for design decisions.
```
{
  "button": {
    "background": {
      "$type": "color",
        "$value": "#0066CC"  # Should reference semantic token like {color.background.primary}
    }
  }
}
```

---

## Scope tokens to their tier

**Identifier:** `cs:styling.tokens.scoping`

Design tokens must be scoped according to their type:
- Primitive tokens: Global scope (system-wide base values)
- Semantic tokens: Theme scope (theme-specific bindings to primitive tokens)
- Component tokens: Component scope (bindings to semantic tokens)

### Do

Define primitive tokens in global scope.
```
{
  "color": {
    "neutral": {
      "100": {
        "$type": "color",
        "$value": "#FFFFFF"
      }
    }
  }
}
```

### Don't

Define primitive tokens in theme scope.
```
{
  "theme": {
    "canonical": {
      "color": {
        "neutral": {
          "100": {
            "$type": "color",
        "$value": "#FFFFFF"  # Should be defined in global scope
          }
        }
      }
    }
  }
}
```

---

## Three tiers of design tokens

**Identifier:** `cs:styling.tokens.types`

Design tokens follow a strict hierarchy:
      - Primitive tokens: Raw values that form the foundation of the design system
      - Semantic tokens: Map semantic concepts to primitive token values
      - Component tokens: Map component properties to semantic token values

### Do

Define semantic tokens that map to primitive tokens.
```
{
  "color": {
    "background": {
      "default": {
        "$type": "color",
        "$value": "{color.neutral.100}"
      }
    }
  }
}
```

### Don't

Skip the semantic layer by mapping component tokens directly to primitives.
```
{
  "button": {
    "padding": {
      "vertical": {
        "$type": "dimension",
        "$value": "{spacing.unit}"  # Should reference semantic token like {spacing.vertical.medium}
      }
    }
  }
}
```

---
