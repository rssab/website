# Contributing Guidelines

Thanks for contributing to Resonant Systems. These guidelines describe the preferred code style and practices for Haxe in this repo. If you are working on hot path code where performance matters, some of these rules may be counterproductive. In those cases, prioritize performance and add a brief comment explaining why.

## Haxe Style

- Configure editor to format document according to Haxe Checkstyle defaults
- Use tabs for indentation

- Prefer `final` over `var`.
- Keep control flow at the lowest possible level by using Haxe expressions. Prefer expression-style control flow: return or assign once and compute a `final` value, or return, with `if`/`switch` expressions. Avoid multiple early `return`s for value selection.


Do:
```haxe
final val = if (shouldDo) {
	someVal;
} else {
	otherVal;
}
```

Do not:
```haxe
var val:Float;
if (shouldDo) {
	val = someVal;
} else {
	val = otherVal;
}
```

- Use functional style and avoid `for` loops. Prefer `thx.core` utilities for array and map operations. `for` loops are only allowed in performance-critical hot paths, in macros or inside array utility classes. If making an exception for performance reasons, add a brief `// PERF:` comment explaining why. 

Do:
```haxe
final values = arr.map(o -> o.val);
```

Do not:
```haxe
var values = [];
for (o in arr) {
	values.push(o.val);
}
```

- Separate data processing from side effects. Use `each` only for side effects.

Do:
```haxe
final positions = bounds.map(b -> {
	x: b.getCenter().x + xOffset,
	y: b.getCenter().y + yOffset,
});
positions.each(p -> {
	object.x = p.x;
	object.y = p.y;
});
```

Do not:
```haxe
bounds.map(b -> {
	object.x = b.getCenter().x + xOffset;
	object.y = b.getCenter().y + yOffset;
});
```

- Always use braces for `if` and `else`. Use ternary for one-line conditionals.

Do:
```haxe
if (ready) {
	start();
} else {
	stop();
}
```

Do not:
```haxe
if (ready) start(); else stop();
```
- Always use single quotes and string interpolation instead of concatenation.

Do:
```haxe
final label = '$name $score';
```

Do not:
```haxe
final label = name + ' ' + score;
```

- Never use parentheses around switch.

Do:
```haxe
switch value {
}
```

Do not:
```haxe
switch (value) {
}
```

- Always use dangling comma in multiline values

Do:
```haxe
final obj = {
	propA: valA,
	propB: valB,
}
```

Do not:
```haxe
final obj = {
	propA: valA,
	propB: valB
}
```


## Side Effects That Also Produce Data

If the same call that creates a side effect will also generate data, use a `for` loop with array comprehension instead of `map`.

Do:
```haxe
final allDone = [
	for (node in nodes) {
		node.init();
	}
];
```

Do not:
```haxe
final allDone = nodes.map(n -> n.init());
```

## Type Annotations

Avoid superfluous typing.

Do:
```haxe
final val = 0.0;
final map = new Map<String, Float>();
final enumValue = MyEnum.Val;
```

Do not:
```haxe
final val:Float = 0.0;
final map:Map<String, Float> = new Map();
final enumValue:MyEnum = MyEnum.Val;
```

## Access Modifiers

- Use implicit private. Omit `private` keyword and rely on default visibility for non-public members.

Do:
```haxe
final cache = new Map<String, Int>();
```

Do not:
```haxe
private final cache = new Map<String, Int>();
```

## Member Ordering

Order members by:

1. `public` before implicit private
2. `final` before `var`
3. `static` before non-static

When touching a class, reorder members to match this list. Do not leave existing members out of order.

Do:
```haxe
class Example {
	public static final max = 10;
	public final name:String;
	public var count = 0;

	static final defaultName = 'demo';
	var enabled = true;
}
```

Do not:
```haxe
class Example {
	var enabled = true;
	public var count = 0;
	public static final max = 10;
	public final name:String;
	static final defaultName = 'demo';
}
```

## Documentation

- Always document `public` members, including parameters and return values.

- Use docs style for documentation. Separate description, params and return with a linebreak. For functions without return, omit `@return` section.

Do:
```haxe
/**
	Sum two floats

	@param a First item to sum
	@param b First item to sum

	@return Sum of a + b
**/
public function sum(a:Float, b:Float):Float {
	return a + b;
}
```

Do not:
```haxe
public function sum(a:Float, b:Float):Float {
	return duration;
}
/**
*	@param  a First item to sum
*	@param  b First item to sum
*	@return Sum of a + b
**/
public function sum(a:Float, b:Float):Float {
	return duration;
}
```

- Keep docs brief. Prefer terse phrasing and drop filler articles (`the`, `a`, `an`) when not needed for clarity. Mention expected units where applicable.
- Avoid 'Value for …' phrasing. Use a short noun phrase describing the item instead.
- For overrides, use `@:inheritDoc` metadata (dox). Add extra lines only when behavior differs.

Do:
```haxe
/**
	@return Tween duration in seconds.
**/
public function getDuration():Float {
	return duration;
}
```

Do not:
```haxe
/**
	@return The duration of the tween
**/
public function getDuration():Float {
	return duration;
}
```

- If a section of code needs clarifying with a comment, use inline style

Do:
```haxe
function attach() {
	enter();
	#if debug
	// Send state change to editor to highlight current scene
	final cl = Type.getClass(this);
	getFromParents(wrench.core.node.Root)?.updateState.trigger(new wrench.editor.StateChange({type: StateType.Scene(cl)}));
	#end
}
```

Do not:
```haxe
function attach() {
	enter();
	#if debug
	/*
	Send state change to editor to highlight current scene
	*/
	final cl = Type.getClass(this);
	getFromParents(wrench.core.node.Root)?.updateState.trigger(new wrench.editor.StateChange({type: StateType.Scene(cl)}));
	#end
}
```

- Remove any commented out code before commit. If work in progress and you want to keep a section for working on, add a `// TODO:` comment explaning what you are planning to do with the code.