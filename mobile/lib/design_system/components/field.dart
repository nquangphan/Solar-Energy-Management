// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.3
// Field.tsx — `.field`/`.field-lg`/`.flabel` in components.css). A controlled
// text input: 1.5px line border → teal on focus, NO glow/shadow (Viền nét).

import 'package:flutter/material.dart';

import '../tokens/app_tokens.dart';

/// Two field sizes: `normal` (`.field`) and `large` (`.field-lg`).
enum AppFieldSize { normal, large }

class AppField extends StatefulWidget {
  const AppField({
    super.key,
    this.label,
    this.controller,
    this.value,
    this.onChanged,
    this.placeholder,
    this.size = AppFieldSize.normal,
    this.keyboardType,
    this.obscureText = false,
    this.semanticsLabel,
  });

  /// Optional `.flabel` micro-uppercase caption above the input.
  final String? label;
  final TextEditingController? controller;

  /// Uncontrolled initial text, used only when [controller] is null.
  final String? value;
  final ValueChanged<String>? onChanged;
  final String? placeholder;
  final AppFieldSize size;
  final TextInputType? keyboardType;

  /// Masks input (parity with web `<Field type="password"/>`). Used by the
  /// login screen's password field (Story 1.11).
  final bool obscureText;

  /// a11y label when no visible [label] is shown (e.g. inline table fields).
  final String? semanticsLabel;

  @override
  State<AppField> createState() => _AppFieldState();
}

class _AppFieldState extends State<AppField> {
  TextEditingController? _owned;

  TextEditingController get _controller =>
      widget.controller ??
      (_owned ??= TextEditingController(text: widget.value));

  @override
  void didUpdateWidget(AppField old) {
    super.didUpdateWidget(old);
    // Controlled parity with React `<input value={...}>`: when the caller pushes
    // a new [value] (e.g. a normalized/clamped qty), reflect it. Guarded so
    // ordinary typing — where the parent echoes the same value straight back —
    // never resets the cursor. Only applies to the owned (uncontrolled) mode.
    if (widget.controller == null &&
        widget.value != null &&
        _owned != null &&
        widget.value != _owned!.text) {
      _owned!.text = widget.value!;
      _owned!.selection =
          TextSelection.collapsed(offset: widget.value!.length);
    }
  }

  @override
  void dispose() {
    _owned?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final large = widget.size == AppFieldSize.large;
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppTokens.radiusDefault),
      borderSide:
          const BorderSide(color: AppTokens.line, width: AppTokens.borderWidth),
    );
    final focusedBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppTokens.radiusDefault),
      borderSide:
          const BorderSide(color: AppTokens.teal, width: AppTokens.borderWidth),
    );

    final input = TextField(
      controller: _controller,
      onChanged: widget.onChanged,
      keyboardType: widget.keyboardType,
      obscureText: widget.obscureText,
      cursorColor: AppTokens.teal,
      style: TextStyle(
        color: AppTokens.ink,
        fontFamily: AppTokens.fontFamily,
        fontSize: large ? 15.0 : 13.5,
      ),
      decoration: InputDecoration(
        isDense: true,
        filled: true,
        fillColor: AppTokens.surface,
        hintText: widget.placeholder,
        hintStyle: const TextStyle(color: Color(0xFF9FB2AD)),
        contentPadding: large
            ? const EdgeInsets.symmetric(horizontal: 14.0, vertical: 13.0)
            : const EdgeInsets.symmetric(horizontal: 12.0, vertical: 10.0),
        enabledBorder: border,
        border: border,
        focusedBorder: focusedBorder,
      ),
    );

    final labelled = widget.label == null
        ? input
        : Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 5.0),
                child: Text(
                  widget.label!.toUpperCase(),
                  style: const TextStyle(
                    color: AppTokens.muted,
                    fontFamily: AppTokens.fontFamily,
                    fontSize: 10.0,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.08 * 10.0,
                  ),
                ),
              ),
              input,
            ],
          );

    final a11y = widget.semanticsLabel ?? widget.label;
    if (a11y == null) return labelled;
    return Semantics(
      textField: true,
      label: a11y,
      child: labelled,
    );
  }
}
