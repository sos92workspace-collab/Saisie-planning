import React from 'react';

export const LegalModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-xl font-black uppercase text-slate-800">Mentions légales</h2>
            <p className="text-sm text-slate-500 font-medium">Dernière mise à jour : 12 août 2026</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 space-y-6 text-sm text-slate-700 leading-relaxed">
          <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <h3 className="font-bold text-slate-900 text-base mb-2">Application « SOS 92 – Choix de Garde »</h3>
            <p className="text-slate-600">Planning de garde des médecins de SOS 92</p>
          </div>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Éditeur</h3>
            <p className="mb-2">Le présent site et l'application « SOS 92 – Choix de Garde » (ci-après « l'Application ») sont édités par :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Dénomination :</strong> S.O.S. 92 – Garde et Urgences Médicales</li>
              <li><strong>Forme juridique :</strong> Société Civile de Moyens (SCM)</li>
              <li><strong>Capital social :</strong> 29 536 euros</li>
              <li><strong>Siège social :</strong> 27 rue de Sèvres, 92100 Boulogne-Billancourt</li>
              <li><strong>Immatriculation :</strong> Immatriculée au RCS de Nanterre sous le n° 314 304 767</li>
              <li><strong>SIREN / SIRET (siège) :</strong> 314 304 767 / 314 304 767 00036</li>
              <li><strong>Code APE / NAF :</strong> 82.19Z (l'activité médicale est en principe exonérée de TVA)</li>
              <li><strong>Représentée par :</strong> le Dr Jérôme Chalvignac et le Dr Colas Maréchal, co-gérants</li>
              <li><strong>E-mail de contact :</strong> gerance@sos92.net</li>
              <li><strong>Téléphone :</strong> 01 46 03 77 44</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Directeur de la publication</h3>
            <p>Les directeurs de la publication sont le Dr Jérôme Chalvignac et le Dr Colas Maréchal, en leur qualité de co-gérants de la SCM S.O.S. 92 – Garde et Urgences Médicales.</p>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Hébergement</h3>
            <p>L'Application repose sur les prestataires techniques suivants, agissant en qualité de sous-traitants au sens du RGPD :</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Interface :</strong> Google fourni par Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlande.</li>
              <li><strong>Base de données, authentification et services applicatifs :</strong> Supabase. Les données de l'Application sont stockées sur des serveurs situés dans l'Union européenne.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Nature et accès à l'Application</h3>
            <p>L'Application est un outil professionnel interne à accès restreint, strictement réservé aux médecins et aux personnels habilités de SOS 92 disposant d'un compte nominatif. Elle n'est pas destinée au grand public ni aux patients, et n'a pas vocation à être librement accessible.</p>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Propriété intellectuelle</h3>
            <p>L'ensemble des éléments composant l'Application (architecture, code source, textes, interfaces, bases de données, logos, marques et signes distinctifs) est protégé par le droit de la propriété intellectuelle et demeure la propriété exclusive de la SCM S.O.S. 92 – Garde et Urgences Médicales ou de ses partenaires. Toute reproduction, représentation, adaptation ou exploitation, totale ou partielle, sans autorisation écrite préalable, est interdite et constitue une contrefaçon.</p>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Données personnelles</h3>
            <p>La SCM S.O.S. 92 – Garde et Urgences Médicales est responsable du traitement des données personnelles collectées via l'Application. Les modalités de traitement (données collectées, finalités, base légale, durées de conservation, droits des personnes) sont détaillées dans l'article « Protection des données personnelles » des Conditions Générales d'Utilisation.</p>
            <p className="mt-2">Conformément au Règlement (UE) 2016/679 (RGPD) et à la loi « Informatique et Libertés », toute personne concernée dispose de droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité, qu'elle peut exercer auprès de gerance@sos92.net. Elle peut également introduire une réclamation auprès de la CNIL (www.cnil.fr).</p>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Contact</h3>
            <p>Pour toute question relative à l'Application ou aux présentes mentions légales : gerance@sos92.net / SCM S.O.S. 92 – Garde et Urgences Médicales, 27 rue de Sèvres, 92100 Boulogne-Billancourt.</p>
          </section>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-bold transition-colors shadow-sm"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
