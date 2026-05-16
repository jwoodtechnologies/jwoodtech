import { useEffect } from "react";
import { LegalPage, Section } from "./LegalPage";

const Terms = () => {
  useEffect(() => {
    document.title = "Terms · Jwood Technologies";
    return () => {
      document.title = "Jwood Technologies";
    };
  }, []);

  return (
    <LegalPage title="Terms of Service" effective="February 2026">
      <Section title="1. Agreement">
        <p>
          These Terms govern your access to Jwood Technologies websites and
          products, including WoodX. By using our products you agree to
          these Terms. If you do not agree, do not use the products.
        </p>
      </Section>

      <Section title="2. Accounts">
        <p>
          To use WoodX you create an account with a valid email address.
          You are responsible for the confidentiality of your password and
          for activity that happens under your account. You must be at least
          13 years old to create an account.
        </p>
      </Section>

      <Section title="3. Acceptable use">
        <p>You agree not to use our products to:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>violate any applicable law or another person's rights;</li>
          <li>send spam, scams, harassment, or unlawful content;</li>
          <li>
            attempt to probe, scan, reverse-engineer, overload or otherwise
            interfere with the service;
          </li>
          <li>
            impersonate another person or misrepresent your affiliation with
            any person or entity.
          </li>
        </ul>
      </Section>

      <Section title="4. Your content">
        <p>
          You retain ownership of the content you send on WoodX. By
          sending content through the service you grant us a limited license
          to store, transmit and display that content solely to deliver the
          product to you and the people you choose to communicate with.
        </p>
      </Section>

      <Section title="5. WoodX messaging features">
        <p>
          WoodX provides privacy-focused messaging tools including
          user-controlled deletion, disappearing messages, pins, mutes and
          tags. The service is offered "as is" and currently in beta. Full
          end-to-end encryption is not enabled in this beta; do not use
          WoodX to transmit information that would be unlawful or unsafe
          to disclose to the service operator.
        </p>
      </Section>

      <Section title="6. Wood AI / EON assistant">
        <p>
          EON, our Wood AI assistant, is a conversational tool. Outputs may
          be inaccurate or incomplete. Do not rely on EON as legal, medical,
          financial or professional advice.
        </p>
      </Section>

      <Section title="7. Calling features">
        <p>
          Voice and video calling entry points are present in the product but
          the underlying call infrastructure is not available in this beta
          and is labelled as "coming soon". We will update these Terms when
          calling is enabled.
        </p>
      </Section>

      <Section title="8. Availability and changes">
        <p>
          We may modify, suspend or discontinue any part of the service at
          any time. We may also update these Terms; material changes will be
          reflected by the effective date at the top of this page.
        </p>
      </Section>

      <Section title="9. Termination">
        <p>
          You can stop using WoodX at any time and delete your account
          from Settings. We may suspend or terminate access if we reasonably
          believe you have violated these Terms or are using the service in a
          way that may harm the service or other users.
        </p>
      </Section>

      <Section title="10. Disclaimers and limits">
        <p>
          The service is provided "as is" without warranties of any kind. To
          the fullest extent permitted by law, Jwood Technologies is not
          liable for any indirect, incidental, special or consequential
          damages, or for loss of profits or data, arising out of your use of
          the service.
        </p>
      </Section>

      <Section title="11. Governing law">
        <p>
          These Terms are governed by the laws of the United States and the
          state where Jwood Technologies is established, without regard to
          conflict-of-law rules.
        </p>
      </Section>
    </LegalPage>
  );
};

export default Terms;
