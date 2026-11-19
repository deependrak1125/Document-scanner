import { PageHeading, Notice, IconBadge } from "../components/experience";
import { Screen } from "../components/Screen";
import { useState } from "react";
import { ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { credentials } from "@folio/validation";
import { Button, Field, Label, layout } from "../components/ui";
import { signIn } from "../features/auth";
export default function Login() {
  return (
    <Screen>
      <LoginContent />
    </Screen>
  );
}
function LoginContent() {
  const [register, setRegister] = useState(false),
    [name, setName] = useState("");
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(credentials),
    defaultValues: { email: "", password: "" },
  });
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={layout.content}
      >
        <IconBadge icon="documents-outline" large />
        <PageHeading
          eyebrow="Your Folio account"
          title={register ? "Create your account" : "Welcome back"}
          subtitle={
            register
              ? "Create your account for optional cloud backup."
              : "Sign in to access your backed-up documents."
          }
        />
        {register && (
          <Field value={name} onChangeText={setName} placeholder="Your name" />
        )}
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Field
              value={field.value}
              onChangeText={field.onChange}
              placeholder="Email address"
            />
          )}
        />
        {errors.email && <Label>{errors.email.message}</Label>}
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <Field
              value={field.value}
              onChangeText={field.onChange}
              placeholder={
                register ? "Password (12 or more characters)" : "Password"
              }
              secureTextEntry
            />
          )}
        />
        {errors.password && <Label>{errors.password.message}</Label>}
        <Button
          icon="arrow-forward-outline"
          title={register ? "Create free account" : "Sign in"}
          onPress={handleSubmit(async (values) => {
            if (register && !name.trim()) throw new Error("Enter your name.");
            await signIn(
              values.email,
              values.password,
              register ? name : undefined,
            );
            router.back();
          })}
        />
        <Button
          title={
            register ? "I already have an account" : "Create a new account"
          }
          secondary
          onPress={() => setRegister(!register)}
        />
        <Notice message="Email and password sign-in does not require SMS. Scanning is free without an account." />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
