{{- define "rallly.labels" -}}
stack: rallly
{{- end -}}

{{- define "rallly.secretName" -}}
{{ .Values.existingSecretName | default "rallly" }}
{{- end -}}

{{- define "rallly.tlsSecretName" -}}
tls-rallly
{{- end -}}

{{/*
The env vars are listed inline instead of coming from a ConfigMap. The Deployment was adopted from
a kubectl-applied manifest that had them inline, and server-side apply never removes list items
another field manager owns, so those stale entries would shadow a ConfigMap forever.
*/}}
{{- define "rallly.env" -}}
{{- $secret := include "rallly.secretName" . -}}
- name: PORT
  value: "3000"
- name: DATABASE_URL
  valueFrom: { secretKeyRef: { name: {{ $secret }}, key: DATABASE_URL } }
- name: SECRET_PASSWORD
  valueFrom: { secretKeyRef: { name: {{ $secret }}, key: SECRET_PASSWORD } }
- name: NEXT_PUBLIC_BASE_URL
  value: {{ printf "https://%s" .Values.hostname | quote }}
- name: SUPPORT_EMAIL
  value: {{ .Values.supportEmail | quote }}
- name: SMTP_HOST
  value: {{ .Values.mail.smtpHostname | quote }}
- name: SMTP_TLS_ENABLED
  value: {{ .Values.mail.smtpTlsEnabled | quote }}
- name: OIDC_NAME
  value: Kompassi
- name: OIDC_DISCOVERY_URL
  value: {{ printf "%s/oidc/.well-known/openid-configuration/" .Values.kompassi.baseUrl | quote }}
- name: OIDC_CLIENT_ID
  valueFrom: { secretKeyRef: { name: {{ $secret }}, key: OIDC_CLIENT_ID } }
- name: OIDC_CLIENT_SECRET
  valueFrom: { secretKeyRef: { name: {{ $secret }}, key: OIDC_CLIENT_SECRET } }
{{- end -}}

{{- define "rallly.probe" -}}
httpGet:
  path: /api/status
  port: 3000
  httpHeaders:
    - name: Host
      value: {{ .Values.hostname | quote }}
{{- end -}}
