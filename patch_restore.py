import re

with open('App.tsx', 'r') as f:
    content = f.read()

# I need to insert the missing block right before:
#       {/* Mobile Bottom Navigation */}
# Wait, it actually went right before:
#           {exchangeMode === 'INACTIVE' && (
#               <div className="flex items-center gap-1">
#                   <button onClick={() => setIsTermsModalOpen(true)} className="p-2 text-slate-300 hover:text-blue-500 md:hidden flex items-center gap-2 ml-2" title="Conditions Générales d'Utilisation">

insert_point = """          {exchangeMode === 'INACTIVE' && (
              <div className="flex items-center gap-1">
                  <button onClick={() => setIsTermsModalOpen(true)} className="p-2 text-slate-300 hover:text-blue-500 md:hidden flex items-center gap-2 ml-2" title="Conditions Générales d'Utilisation">"""

missing_block = """      {!isConsultationMode && <RoundInfo round={activeRound} stepInstruction={currentStepInstruction} />}

      {/* Barre de navigation dédiée (Desktop) */}
      {exchangeMode === 'INACTIVE' && viewMode !== ViewMode.LOGIN && (
          <div className="bg-slate-50/80 backdrop-blur-sm border-b px-6 py-2.5 items-center justify-between z-40 shrink-0 hidden md:flex shadow-sm">
              <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[11px] shadow-inner border ${currentUser?.role === 'SUBSTITUTE' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                        {trigram.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <div className="text-[12px] font-black uppercase text-slate-900 leading-none mb-1">{trigram.toUpperCase()}</div>
                        <div className={`text-[8px] font-black uppercase tracking-widest leading-none ${currentUser?.role === 'SUBSTITUTE' ? 'text-orange-600' : 'text-blue-600'}`}>
                          {currentUser?.role === 'SUBSTITUTE' ? 'Remplaçant' : 'Titulaire'}
                        </div>
                    </div>
                  </div>
              </div>

              <div className="flex items-center gap-3">
                  {!isConsultationMode && currentStep > AppStep.NORMAL_SELECTION && (
                     <button onClick={goToPrevStep} className="px-6 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-all whitespace-nowrap">Précédent</button>
                  )}

                  {!isConsultationMode && (currentStep < AppStep.RECAP_ORDERING ? (
                      <button onClick={goToNextStep} className="px-8 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 shadow-md whitespace-nowrap transition-colors">Suivant</button>
                  ) : (
                      <button onClick={handleFinalValidation} className="px-8 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-700 shadow-md whitespace-nowrap transition-all animate-pulse">Valider mes choix</button>
                  ))}
                  
                  <div className="w-px h-6 bg-slate-200 mx-2"></div>

                  <button onClick={() => setIsTermsModalOpen(true)} className="p-2 border border-slate-200 rounded-xl bg-white text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-2" title="Conditions Générales d'Utilisation">
                      <span className="text-[10px] font-black uppercase">CGU</span>
                  </button>
                  <button onClick={() => setIsLegalModalOpen(true)} className="p-2 border border-slate-200 rounded-xl bg-white text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-2" title="Mentions légales">
                      <span className="text-[10px] font-black uppercase">Légal</span>
                  </button>
                  
                  <button onClick={handleLogout} className="p-2 border border-slate-200 rounded-xl bg-white text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors shadow-sm flex items-center gap-2" title="Déconnexion">
                      <span className="text-[10px] font-black uppercase">Quitter</span>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2 2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5"/></svg>
                  </button>
              </div>
          </div>
      )}
      
      <header className="bg-white border-b px-4 h-[72px] flex items-center justify-between z-30 shrink-0 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-6">
            {!isConsultationMode && <StepProgressBar currentStep={currentStep} round={activeRound} />}
            {isConsultationMode && (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-200">
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/></svg>
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">Consultation Planning</h1>
                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Mode Lecture Seule</p>
                    </div>
                </div>
            )}
        </div>
        <div className="flex items-center gap-4">
            {currentUser?.role !== 'ADMIN' && (
                <div className="flex items-center gap-2">
                    {activeRound?.allow_exchanges && isConsultationMode && takeMode === 'INACTIVE' && (
                        <>
                        <button 
                            onClick={() => {
                                if (exchangeMode === 'INACTIVE') {
                                    setExchangeMode('SELECT_OWN');
                                    setSelectedOwnChoice(null);
                                    setPossibleTargetChoices([]);
                                    setTakeMode('INACTIVE');
                                } else {
                                    setExchangeMode('INACTIVE');
                                }
                            }}
                            className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-black uppercase transition-all shadow-sm whitespace-nowrap ${exchangeMode !== 'INACTIVE' ? 'bg-orange-500 text-white border-orange-600 hover:bg-orange-600' : 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-500 hover:text-white'}`}
                        >
                            <span className="hidden md:inline">{exchangeMode !== 'INACTIVE' ? 'Annuler l\\'échange' : 'Échanger une garde'}</span>
                            <span className="md:hidden">{exchangeMode !== 'INACTIVE' ? 'Annuler' : 'Échanger'}</span>
                        </button>
                        {exchangeMode === 'INACTIVE' && (
                           <button
                                onClick={() => setIsExchangeSidebarOpen(true)}
                               className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-black uppercase transition-all shadow-sm whitespace-nowrap ${myPendingExchanges.length > 0 ? 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                           >
                               <span className="hidden md:inline">Mes Échanges ({myPendingExchanges.length})</span>
                               <span className="md:hidden">Échanges ({myPendingExchanges.length})</span>
                           </button>
                        )}
                        </>
                    )}
                    {activeRound?.allow_takes && isConsultationMode && exchangeMode === 'INACTIVE' && (
                        <>
                        <button 
                            onClick={() => {
                                if (takeMode !== 'INACTIVE') {
                                    setTakeMode('INACTIVE');
                                } else {
                                    setTakeMode('SELECT_TARGET');
                                    setExchangeMode('INACTIVE');
                                }
                            }}
                            className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-black uppercase transition-all shadow-sm whitespace-nowrap ${takeMode !== 'INACTIVE' ? 'bg-teal-500 text-white border-teal-600 hover:bg-teal-600' : 'bg-teal-50 text-teal-600 border-teal-100 hover:bg-teal-500 hover:text-white'}`}
                        >
                            <span className="hidden md:inline">{takeMode !== 'INACTIVE' ? 'Arrêter de prendre des gardes' : 'Prendre des gardes'}</span>
                            <span className="md:hidden">{takeMode !== 'INACTIVE' ? 'Arrêter' : 'Prendre'}</span>
                        </button>
                        {takeMode === 'INACTIVE' && (
                           <button
                                onClick={() => setIsTakeSidebarOpen(true)}
                               className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-black uppercase transition-all shadow-sm whitespace-nowrap ${myPendingTakes.length > 0 ? 'bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                           >
                               <span className="hidden md:inline">Mes Prises ({myPendingTakes.length})</span>
                               <span className="md:hidden">Prises ({myPendingTakes.length})</span>
                           </button>
                        )}
                        </>
                    )}
                    {(viewMode === ViewMode.APP || isConsultationMode) && exchangeMode === 'INACTIVE' && takeMode === 'INACTIVE' && (
                        <div className="hidden md:flex items-center gap-2 border-l border-slate-200 pl-4">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Affichage</span>
                            <button onClick={() => setShowMyChoicesOnly(false)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors ${!showMyChoicesOnly ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                <span className="hidden xl:inline">Toutes les gardes</span>
                                <span className="xl:hidden">Toutes</span>
                            </button>
                            <button onClick={() => setShowMyChoicesOnly(true)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors ${showMyChoicesOnly ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                <span className="hidden xl:inline">Mes gardes uniquement</span>
                                <span className="xl:hidden">Mes gardes</span>
                            </button>
                            <button onClick={() => setShowUnassignedOnly(!showUnassignedOnly)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors ${showUnassignedOnly ? 'bg-red-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                <span className="hidden md:inline">Non demandées</span>
                                <span className="md:hidden">Non demandées</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
"""

content = content.replace(insert_point, missing_block + insert_point)

with open('App.tsx', 'w') as f:
    f.write(content)
