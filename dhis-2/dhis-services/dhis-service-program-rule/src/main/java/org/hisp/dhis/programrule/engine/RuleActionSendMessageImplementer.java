/*
 * Copyright (c) 2004-2021, University of Oslo
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * Redistributions of source code must retain the above copyright notice, this
 * list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 * Neither the name of the HISP project nor the names of its contributors may
 * be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
package org.hisp.dhis.programrule.engine;

import org.hisp.dhis.notification.logging.ExternalNotificationLogEntry;
import org.hisp.dhis.notification.logging.NotificationLoggingService;
import org.hisp.dhis.notification.logging.NotificationTriggerEvent;
import org.hisp.dhis.program.ProgramInstance;
import org.hisp.dhis.program.ProgramInstanceService;
import org.hisp.dhis.program.ProgramStageInstance;
import org.hisp.dhis.program.ProgramStageInstanceService;
import org.hisp.dhis.program.notification.*;
import org.hisp.dhis.program.notification.event.ProgramRuleEnrollmentEvent;
import org.hisp.dhis.program.notification.event.ProgramRuleStageEvent;
import org.hisp.dhis.rules.models.RuleAction;
import org.hisp.dhis.rules.models.RuleActionSendMessage;
import org.hisp.dhis.rules.models.RuleEffect;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * <ol>
 * <li>Handle notifications related to enrollment/event</li>
 * <li>Trigger spring event to handle notification delivery in separate thread
 * <li/>
 * <li>Log and entry in {@link ExternalNotificationLogEntry}</li>
 * </ol>
 *
 * @author Zubair Asghar
 */
@Component( "org.hisp.dhis.programrule.engine.RuleActionSendMessageImplementer" )
public class RuleActionSendMessageImplementer extends NotificationRuleActionImplementer
{
    // -------------------------------------------------------------------------
    // Dependencies
    // -------------------------------------------------------------------------

    private final ApplicationEventPublisher publisher;

    public RuleActionSendMessageImplementer( ProgramNotificationTemplateService programNotificationTemplateService,
        NotificationLoggingService notificationLoggingService,
        ProgramInstanceService programInstanceService,
        ProgramStageInstanceService programStageInstanceService,
        ApplicationEventPublisher publisher )
    {
        super( programNotificationTemplateService, notificationLoggingService, programInstanceService,
            programStageInstanceService );
        this.publisher = publisher;
    }

    @Override
    public boolean accept( RuleAction ruleAction )
    {
        return ruleAction instanceof RuleActionSendMessage;
    }

    @Override
    @Transactional
    public void implement( RuleEffect ruleEffect, ProgramInstance programInstance )
    {
        if ( !validate( ruleEffect, programInstance ) )
        {
            return;
        }

        ProgramNotificationTemplate template = getNotificationTemplate( ruleEffect.ruleAction() );

        if ( template == null )
        {
            return;
        }

        String key = generateKey( template, programInstance );

        publisher.publishEvent( new ProgramRuleEnrollmentEvent( this, template.getId(), programInstance.getId() ) );

        ExternalNotificationLogEntry entry = createLogEntry( key, template.getUid() );
        entry.setNotificationTriggeredBy( NotificationTriggerEvent.PROGRAM );
        notificationLoggingService.save( entry );
    }

    @Override
    @Transactional
    public void implement( RuleEffect ruleEffect, ProgramStageInstance programStageInstance )
    {
        checkNulls( ruleEffect, programStageInstance );

        // For program without registration
        if ( programStageInstance.getProgramStage().getProgram().isWithoutRegistration() )
        {
            handleSingleEvent( ruleEffect, programStageInstance );
            return;
        }

        if ( !validate( ruleEffect, programStageInstance.getProgramInstance() ) )
        {
            return;
        }

        ProgramNotificationTemplate template = getNotificationTemplate( ruleEffect.ruleAction() );

        if ( template == null )
        {
            return;
        }

        String key = generateKey( template, programStageInstance.getProgramInstance() );

        publisher.publishEvent( new ProgramRuleStageEvent( this, template.getId(), programStageInstance.getId() ) );

        ExternalNotificationLogEntry entry = createLogEntry( key, template.getUid() );
        entry.setNotificationTriggeredBy( NotificationTriggerEvent.PROGRAM_STAGE );

        notificationLoggingService.save( entry );
    }

    @Override
    @Transactional
    public void implementEnrollmentAction( RuleEffect ruleEffect, String programInstance )
    {
        implement( ruleEffect, programInstanceService.getProgramInstance( programInstance ) );
    }

    @Override
    @Transactional
    public void implementEventAction( RuleEffect ruleEffect, String programStageInstance )
    {
        implement( ruleEffect, programStageInstanceService.getProgramStageInstance( programStageInstance ) );
    }

    private void handleSingleEvent( RuleEffect ruleEffect, ProgramStageInstance programStageInstance )
    {
        ProgramNotificationTemplate template = getNotificationTemplate( ruleEffect.ruleAction() );

        if ( template == null )
        {
            return;
        }

        publisher.publishEvent( new ProgramRuleStageEvent( this, template.getId(), programStageInstance.getId() ) );
    }
}